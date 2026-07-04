import { MockSensVendor } from "./mock-sens.adapter";

describe("MockSensVendor", () => {
  const vendor = new MockSensVendor();

  it("sendAlimtalk succeeds on the KAKAO channel", async () => {
    const result = await vendor.sendAlimtalk({ templateCode: "VPAYOTP", to: "01012345678", content: "hi" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("KAKAO");
    expect(result.provider).toBe("NCP_SENS_MOCK");
    expect(result.externalId).toMatch(/^K-mock-/);
  });

  it("sendSms succeeds on the SMS channel", async () => {
    const result = await vendor.sendSms({ to: "01012345678", content: "hi" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("SMS");
    expect(result.provider).toBe("NCP_SENS_MOCK");
    expect(result.externalId).toMatch(/^S-mock-/);
  });
});
