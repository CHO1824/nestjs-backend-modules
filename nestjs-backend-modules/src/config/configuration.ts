export interface ConfigurationSchema {
  app: {
    port: number;
    url: string;
    nodeEnv: string;
    debug: boolean;
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    accessTokenDuration: string;
    refreshTokenDuration: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    allowedRedirectUris: string[];
    mobileClientIds: string[];
  };
  mailgun: {
    apiKey: string;
    domain: string;
    apiUrl: string;
    fromEmail: string;
    fromName: string;
  };
  firebase: {
    projectId: string;
    credentialsPath: string;
    gcpManagedRuntime: boolean;
  };
  internal: {
    apiKey: string;
  };
  openbanking: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  wise: {
    apiUrl: string;
    apiToken: string;
    profileId: string;
  };
  kyc: {
    provider: string;
  };
  ncp: {
    accessKey: string;
    secretKey: string;
    storage: {
      endpoint: string;
      region: string;
      bucket: string;
    };
    ekyc: {
      invokeUrl: string;
      secretKey: string;
    };
    ocr: {
      invokeUrl: string;
      passportInvokeUrl: string;
      secretKey: string;
    };
    sens: {
      enabled: boolean;
      endpoint: string;
      alimtalkServiceId: string;
      smsServiceId: string;
      kakaoChannelId: string;
      smsFrom: string;
    };
  };
  fx: {
    featureFlags: {
      quoteDbWriteEnabled: boolean;
      confirmDbGuardEnabled: boolean;
      quoteCacheEnabled: boolean;
      publicConfirmApiEnabled: boolean;
    };
    quoteTtlSeconds: number;
  };
  siteConfig: {
    support: {
      email: string | null;
      helpCenterUrl: string | null;
    };
    social: {
      twitter: string | null;
      linkedin: string | null;
      facebook: string | null;
      instagram: string | null;
      naverBlog: string | null;
      youtube: string | null;
    };
    appStore: {
      iosUrl: string | null;
      androidUrl: string | null;
    };
    cacheTtlSeconds: number;
  };
  landingContent: {
    featureFlags: {
      noticesEnabled: boolean;
      partnershipsEnabled: boolean;
      pressEnabled: boolean;
    };
    cacheTtlSeconds: number;
    itemCacheTtlSeconds: number;
  };
}

// Empty / whitespace env values are normalized to null so consumers can rely on
// `null` as the single "unset" signal — frontend renders such CTAs as disabled.
function emptyToNull(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Reject anything that is not http(s) so a typo or javascript: payload in the
// env never reaches the public response. Boot-time validation, not per-request.
function safeUrl(value: string | null): string | null {
  if (value === null) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

function safeEmail(value: string | null): string | null {
  if (value === null) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function parsePositiveInt(value: string | undefined, fallback: number, minimum = 1): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }
  return parsed;
}

export default (): ConfigurationSchema => ({
  app: {
    port: parseInt(process.env.APP_PORT || "8080", 10),
    url: process.env.APP_URL || "http://localhost:8080",
    nodeEnv: process.env.NODE_ENV || "development",
    debug: process.env.DEBUG === "true",
  },
  database: {
    url: process.env.DATABASE_URL || "",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || "",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "your-refresh-secret-key",
    accessTokenDuration: process.env.JWT_ACCESS_TOKEN_DURATION || "24h",
    refreshTokenDuration: process.env.JWT_REFRESH_TOKEN_DURATION || "168h",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    allowedRedirectUris: (process.env.GOOGLE_ALLOWED_REDIRECT_URIS || "")
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean),
    mobileClientIds: (process.env.GOOGLE_MOBILE_CLIENT_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  },
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || "",
    domain: process.env.MAILGUN_DOMAIN || "",
    apiUrl: process.env.MAILGUN_API_URL || "https://api.mailgun.net",
    // No real-address fallback. EmailSender / MailService Fail-Fast at boot
    // when MAILGUN_FROM_EMAIL is missing — an unauthorized sender (without
    // SPF/DKIM) silently routes transactional mail to spam, which is worse
    // than refusing to start.
    fromEmail: process.env.MAILGUN_FROM_EMAIL || "",
    fromName: process.env.MAILGUN_FROM_NAME || "VPay",
  },
  firebase: {
    // Auth comes from ADC: credentialsPath (GOOGLE_APPLICATION_CREDENTIALS)
    // points to a WIF cred-config or service-account key file. No static key in
    // config — see NotificationModule.onModuleInit().
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
    // True inside a GCP-managed runtime (Cloud Run / App Engine / GCE), where ADC
    // resolves credentials from the metadata server without a credentials file.
    gcpManagedRuntime: !!(process.env.K_SERVICE || process.env.GAE_SERVICE || process.env.GOOGLE_CLOUD_PROJECT),
  },
  internal: {
    // No fallback. InternalApiKeyGuard hard-401s every /internal/* request
    // when this is empty — keeping the value empty disables the surface
    // entirely rather than accepting a guessable default.
    apiKey: process.env.INTERNAL_API_KEY || "",
  },
  openbanking: {
    apiUrl: process.env.OPENBANKING_API_URL || "https://testapi.openbanking.or.kr",
    clientId: process.env.OPENBANKING_CLIENT_ID || "",
    clientSecret: process.env.OPENBANKING_CLIENT_SECRET || "",
    callbackUrl: process.env.OPENBANKING_CALLBACK_URL || "http://localhost:3333/api/openbanking/callback",
  },
  wise: {
    apiUrl: process.env.WISE_API_URL || "https://api.sandbox.transferwise.tech",
    apiToken: process.env.WISE_API_TOKEN || "",
    profileId: process.env.WISE_PROFILE_ID || "",
  },
  kyc: {
    provider: process.env.KYC_PROVIDER || "ncp",
  },
  ncp: {
    accessKey: process.env.NCP_ACCESS_KEY || "",
    secretKey: process.env.NCP_SECRET_KEY || "",
    storage: {
      endpoint: process.env.NCP_STORAGE_ENDPOINT || "https://kr.object.fin-ncloudstorage.com",
      region: process.env.NCP_STORAGE_REGION || "fin-standard",
      bucket: process.env.NCP_STORAGE_BUCKET || "",
    },
    ekyc: {
      invokeUrl: process.env.NCP_EKYC_INVOKE_URL || "",
      secretKey: process.env.NCP_EKYC_SECRET_KEY || "",
    },
    ocr: {
      invokeUrl: process.env.NCP_OCR_INVOKE_URL || "",
      passportInvokeUrl: process.env.NCP_OCR_PASSPORT_INVOKE_URL || "",
      secretKey: process.env.NCP_OCR_SECRET_KEY || "",
    },
    // NCP SENS (Alimtalk + SMS). Mock until enabled + keys set.
    sens: {
      enabled: process.env.NCP_SENS_ENABLED === "true",
      endpoint: process.env.NCP_SENS_ENDPOINT || "https://sens.apigw.fin-ntruss.com",
      alimtalkServiceId: process.env.NCP_SENS_ALIMTALK_SERVICE_ID || "",
      smsServiceId: process.env.NCP_SENS_SMS_SERVICE_ID || "",
      kakaoChannelId: process.env.NCP_SENS_KAKAO_CHANNEL_ID || "",
      smsFrom: process.env.NCP_SENS_SMS_FROM || "",
    },
  },
  fx: {
    featureFlags: {
      // Gates Quote DB persistence. When false, POST /quotes returns an error.
      // Default false; flip to true during Phase 2 rollout.
      quoteDbWriteEnabled: process.env.FX_QUOTE_DB_WRITE_ENABLED === "true",
      // Reserved: conditional-UPDATE guard is always on at the repository level.
      // Kept in config for observability / future kill-switch wiring.
      confirmDbGuardEnabled: process.env.FX_CONFIRM_DB_GUARD_ENABLED !== "false",
      // Reserved: Redis cache layer not yet implemented (Phase 3 FxFeeder work).
      quoteCacheEnabled: process.env.FX_QUOTE_CACHE_ENABLED !== "false",
      // Gates POST /quotes/:id/confirm endpoint. Default false.
      publicConfirmApiEnabled: process.env.FX_PUBLIC_CONFIRM_API_ENABLED === "true",
    },
    // Quote TTL pending JAY confirmation (1min vs 3min). Default 180s.
    quoteTtlSeconds: parsePositiveInt(process.env.FX_QUOTE_TTL_SECONDS, 180, 1),
  },
  siteConfig: {
    support: {
      email: safeEmail(emptyToNull(process.env.SUPPORT_EMAIL)),
      helpCenterUrl: safeUrl(emptyToNull(process.env.SUPPORT_HELP_CENTER_URL)),
    },
    social: {
      twitter: safeUrl(emptyToNull(process.env.SOCIAL_TWITTER_URL)),
      linkedin: safeUrl(emptyToNull(process.env.SOCIAL_LINKEDIN_URL)),
      facebook: safeUrl(emptyToNull(process.env.SOCIAL_FACEBOOK_URL)),
      instagram: safeUrl(emptyToNull(process.env.SOCIAL_INSTAGRAM_URL)),
      naverBlog: safeUrl(emptyToNull(process.env.SOCIAL_NAVER_BLOG_URL)),
      youtube: safeUrl(emptyToNull(process.env.SOCIAL_YOUTUBE_URL)),
    },
    appStore: {
      iosUrl: safeUrl(emptyToNull(process.env.APP_STORE_IOS_URL)),
      androidUrl: safeUrl(emptyToNull(process.env.APP_STORE_ANDROID_URL)),
    },
    cacheTtlSeconds: parsePositiveInt(process.env.SITE_CONFIG_CACHE_TTL_SECONDS, 300, 1),
  },
  landingContent: {
    featureFlags: {
      // Per-category cutover flags. Default false so the public API returns
      // empty lists until the frontend removes the corresponding hardcoded
      // section. See ADR / migration plan in docs/landingPage/.
      noticesEnabled: process.env.LANDING_CMS_NOTICES_ENABLED === "true",
      partnershipsEnabled: process.env.LANDING_CMS_PARTNERSHIPS_ENABLED === "true",
      pressEnabled: process.env.LANDING_CMS_PRESS_ENABLED === "true",
    },
    cacheTtlSeconds: parsePositiveInt(process.env.LANDING_CONTENT_CACHE_TTL_SECONDS, 120, 1),
    itemCacheTtlSeconds: parsePositiveInt(process.env.LANDING_CONTENT_ITEM_CACHE_TTL_SECONDS, 300, 1),
  },
});
