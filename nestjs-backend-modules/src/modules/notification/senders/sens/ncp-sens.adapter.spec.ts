import { NcpSensConfig, NcpSensVendor } from "./ncp-sens.adapter";

const BASE_CONFIG: NcpSensConfig = {
  accessKey: "access-key",
  secretKey: "secret-key",
  endpoint: "https://sens.apigw.fin-ntruss.com",
  alimtalkServiceId: "ncp:kkobizmsg:fkr:1:vpay",
  smsServiceId: "ncp:sms:fkr:2:vpay",
  kakaoChannelId: "@vpayv",
  smsFrom: "01000000000",
};

type FetchMock = jest.Mock<Promise<Response>>;

function mockFetch(response: { ok: boolean; status: number; body: unknown }): FetchMock {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  } as Response) as FetchMock;
  global.fetch = fn;
  return fn;
}

/** Parses the JSON body passed to fetch on its first call. */
function sentBody(fetchFn: FetchMock): Record<string, unknown> {
  const init = fetchFn.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("NcpSensVendor", () => {
  const originalFetch = global.fetch;
  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("sendAlimtalk", () => {
    it("posts to the Alimtalk endpoint with the signature headers", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: { requestId: "req-1" } });
      const vendor = new NcpSensVendor(BASE_CONFIG);

      const result = await vendor.sendAlimtalk({ templateCode: "VPAYOTP", to: "010-1234-5678", content: "code 123" });

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://sens.apigw.fin-ntruss.com/alimtalk/v2/services/ncp%3Akkobizmsg%3Afkr%3A1%3Avpay/messages",
      );
      const headers = init.headers as Record<string, string>;
      expect(headers["x-ncp-iam-access-key"]).toBe("access-key");
      expect(headers["x-ncp-apigw-timestamp"]).toMatch(/^\d+$/);
      expect(headers["x-ncp-apigw-signature-v2"]).toMatch(/^[A-Za-z0-9+/]+=*$/);

      expect(result.success).toBe(true);
      expect(result.channel).toBe("KAKAO");
      expect(result.provider).toBe("NCP_SENS");
      expect(result.externalId).toBe("req-1");
    });

    it("normalizes the recipient to bare digits", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: { requestId: "req-1" } });
      await new NcpSensVendor(BASE_CONFIG).sendAlimtalk({
        templateCode: "VPAYOTP",
        to: "+82 10-1234-5678",
        content: "x",
      });

      const body = sentBody(fetchFn);
      const messages = body.messages as Array<{ to: string }>;
      expect(messages[0].to).toBe("821012345678");
      expect(body.plusFriendId).toBe("@vpayv");
      expect(body.templateCode).toBe("VPAYOTP");
    });

    it("enables useSmsFailover when failover content + sender number are set", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: { requestId: "req-1" } });
      await new NcpSensVendor(BASE_CONFIG).sendAlimtalk({
        templateCode: "VPAYOTP",
        to: "01012345678",
        content: "x",
        smsFailoverContent: "[VPAY] fallback",
      });

      const message = (sentBody(fetchFn).messages as Array<Record<string, unknown>>)[0];
      expect(message.useSmsFailover).toBe(true);
      expect(message.failoverConfig).toEqual({ type: "SMS", from: "01000000000", content: "[VPAY] fallback" });
    });

    it("omits useSmsFailover when no sender number is configured", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: { requestId: "req-1" } });
      await new NcpSensVendor({ ...BASE_CONFIG, smsFrom: "" }).sendAlimtalk({
        templateCode: "VPAYOTP",
        to: "01012345678",
        content: "x",
        smsFailoverContent: "[VPAY] fallback",
      });

      const message = (sentBody(fetchFn).messages as Array<Record<string, unknown>>)[0];
      expect(message.useSmsFailover).toBeUndefined();
    });

    it("returns failure on a non-2xx response", async () => {
      mockFetch({ ok: false, status: 401, body: { statusName: "Unauthorized" } });
      const result = await new NcpSensVendor(BASE_CONFIG).sendAlimtalk({
        templateCode: "VPAYOTP",
        to: "01012345678",
        content: "x",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });

    it("returns failure when fetch throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNRESET")) as FetchMock;
      const result = await new NcpSensVendor(BASE_CONFIG).sendAlimtalk({
        templateCode: "VPAYOTP",
        to: "01012345678",
        content: "x",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("ECONNRESET");
    });
  });

  describe("sendSms", () => {
    it("posts to the SMS endpoint with from + normalized recipient", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: { requestId: "sms-1" } });
      const result = await new NcpSensVendor(BASE_CONFIG).sendSms({ to: "+821012345678", content: "hi" });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://sens.apigw.fin-ntruss.com/sms/v2/services/ncp%3Asms%3Afkr%3A2%3Avpay/messages");
      const body = sentBody(fetchFn);
      expect(body.from).toBe("01000000000");
      expect((body.messages as Array<{ to: string }>)[0].to).toBe("821012345678");

      expect(result.success).toBe(true);
      expect(result.channel).toBe("SMS");
      expect(result.externalId).toBe("sms-1");
    });

    it("uses SMS type for short content and LMS for long content", async () => {
      const short = mockFetch({ ok: true, status: 202, body: { requestId: "s" } });
      await new NcpSensVendor(BASE_CONFIG).sendSms({ to: "01012345678", content: "123456" });
      expect(sentBody(short).type).toBe("SMS");

      const long = mockFetch({ ok: true, status: 202, body: { requestId: "l" } });
      await new NcpSensVendor(BASE_CONFIG).sendSms({ to: "01012345678", content: "가".repeat(45) });
      expect(sentBody(long).type).toBe("LMS");
    });

    it("returns failure without calling NCP when SMS is not configured", async () => {
      const fetchFn = mockFetch({ ok: true, status: 202, body: {} });
      const result = await new NcpSensVendor({ ...BASE_CONFIG, smsFrom: "" }).sendSms({
        to: "01012345678",
        content: "x",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("config validation", () => {
    it("throws when a required field is missing", () => {
      expect(() => new NcpSensVendor({ ...BASE_CONFIG, accessKey: "" })).toThrow(/accessKey/);
    });

    it("allows construction without SMS fields (Alimtalk-only)", () => {
      expect(() => new NcpSensVendor({ ...BASE_CONFIG, smsServiceId: "", smsFrom: "" })).not.toThrow();
    });
  });
});
