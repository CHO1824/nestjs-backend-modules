import { HttpException, HttpStatus } from "@nestjs/common";

export class AppError extends HttpException {
  public readonly code: string;
  public readonly details: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details: Record<string, unknown> | null = null,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}

// Auth Errors
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password", HttpStatus.UNAUTHORIZED);
  }
}
export class UserNotFoundError extends AppError {
  constructor() {
    super("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
  }
}
export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super("INVALID_REFRESH_TOKEN", "Refresh token is invalid", HttpStatus.UNAUTHORIZED);
  }
}
export class RefreshTokenExpiredError extends AppError {
  constructor() {
    super("REFRESH_TOKEN_EXPIRED", "Refresh token has expired", HttpStatus.UNAUTHORIZED);
  }
}
export class InvalidCountryError extends AppError {
  constructor() {
    super("INVALID_COUNTRY", "Invalid country code", HttpStatus.BAD_REQUEST);
  }
}
export class InvalidOTPError extends AppError {
  constructor() {
    super("INVALID_OTP", "OTP is invalid", HttpStatus.BAD_REQUEST);
  }
}
export class OTPExpiredError extends AppError {
  constructor() {
    super("OTP_EXPIRED", "OTP has expired", HttpStatus.BAD_REQUEST);
  }
}
export class PasswordChangeFailedError extends AppError {
  constructor() {
    super("PASSWORD_CHANGE_FAILED", "Password change failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

// User Errors
export class PhoneAlreadyInUseError extends AppError {
  constructor() {
    super("PHONE_ALREADY_IN_USE", "Phone number is already registered", HttpStatus.CONFLICT);
  }
}
export class SamePhoneNumberError extends AppError {
  constructor() {
    super("SAME_PHONE_NUMBER", "New phone is the same as current", HttpStatus.BAD_REQUEST);
  }
}
export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super("EMAIL_ALREADY_IN_USE", "Email is already registered", HttpStatus.CONFLICT);
  }
}
export class SameEmailError extends AppError {
  constructor() {
    super("SAME_EMAIL", "New email is the same as current", HttpStatus.BAD_REQUEST);
  }
}
export class WrongCurrentPasswordError extends AppError {
  constructor() {
    super("WRONG_CURRENT_PASSWORD", "Current password is incorrect", HttpStatus.UNAUTHORIZED);
  }
}
export class PasswordAlreadyExistsError extends AppError {
  constructor() {
    super("PASSWORD_ALREADY_EXISTS", "Password already set", HttpStatus.CONFLICT);
  }
}
export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super("EMAIL_ALREADY_EXISTS", "Email is already registered", HttpStatus.CONFLICT);
  }
}
export class PasswordMismatchError extends AppError {
  constructor() {
    super("PASSWORD_MISMATCH", "Passwords do not match", HttpStatus.BAD_REQUEST);
  }
}
export class InvalidVerificationTokenError extends AppError {
  constructor() {
    super("INVALID_VERIFICATION_TOKEN", "Verification token is invalid", HttpStatus.UNAUTHORIZED);
  }
}
export class PhoneNumberNotSetError extends AppError {
  constructor() {
    super("PHONE_NUMBER_NOT_SET", "Phone number has not been set", HttpStatus.BAD_REQUEST);
  }
}
export class EmailNotSetError extends AppError {
  constructor() {
    super("EMAIL_NOT_SET", "Email has not been set", HttpStatus.BAD_REQUEST);
  }
}

// Transfer Errors
export class InvalidCurrencyError extends AppError {
  constructor() {
    super("INVALID_CURRENCY", "Unsupported currency", HttpStatus.BAD_REQUEST);
  }
}
export class RateNotAvailableError extends AppError {
  constructor() {
    super("RATE_NOT_AVAILABLE", "Exchange rate not available", HttpStatus.NOT_FOUND);
  }
}
export class SameCurrencyError extends AppError {
  constructor() {
    super("SAME_CURRENCY_CONVERSION", "Cannot convert between same currency", HttpStatus.BAD_REQUEST);
  }
}
export class MissingCurrencyError extends AppError {
  constructor() {
    super("MISSING_CURRENCY_PARAMETERS", "Currency parameters are required", HttpStatus.BAD_REQUEST);
  }
}
export class InvalidAmountError extends AppError {
  constructor() {
    super("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
  }
}

// Social Auth Errors
export class GoogleAuthError extends AppError {
  constructor() {
    super("GOOGLE_AUTH_FAILED", "Google authentication failed", HttpStatus.UNAUTHORIZED);
  }
}
export class SocialAuthMissingEmailError extends AppError {
  constructor() {
    super("SOCIAL_AUTH_MISSING_EMAIL", "Social account does not have an email", HttpStatus.BAD_REQUEST);
  }
}
export class PasswordRequiredError extends AppError {
  constructor() {
    super("PASSWORD_REQUIRED", "Password is required", HttpStatus.BAD_REQUEST);
  }
}
export class ResetTokenInvalidError extends AppError {
  constructor() {
    super("RESET_TOKEN_INVALID", "Password reset token is invalid", HttpStatus.BAD_REQUEST);
  }
}
export class ResetTokenExpiredError extends AppError {
  constructor() {
    super("RESET_TOKEN_EXPIRED", "Password reset token has expired", HttpStatus.BAD_REQUEST);
  }
}
export class ResetTokenAlreadyUsedError extends AppError {
  constructor() {
    super("RESET_TOKEN_ALREADY_USED", "Reset token has already been used", HttpStatus.BAD_REQUEST);
  }
}
export class PasswordResetRateLimitedError extends AppError {
  constructor() {
    super("PASSWORD_RESET_RATE_LIMITED", "Too many password reset attempts", HttpStatus.TOO_MANY_REQUESTS);
  }
}
export class InvalidRedirectUriError extends AppError {
  constructor() {
    super("INVALID_REDIRECT_URI", "Redirect URI is not allowed", HttpStatus.BAD_REQUEST);
  }
}
// PIN Errors
export class PinNotSetError extends AppError {
  constructor() {
    super("PIN_NOT_SET", "PIN is not set", HttpStatus.BAD_REQUEST);
  }
}
export class PinAlreadySetError extends AppError {
  constructor() {
    super("PIN_ALREADY_SET", "PIN is already set", HttpStatus.CONFLICT);
  }
}
export class InvalidPinError extends AppError {
  constructor(remainingAttempts?: number) {
    const message =
      remainingAttempts !== undefined ? `Invalid PIN. ${remainingAttempts} attempt(s) remaining` : "Invalid PIN";
    const details = remainingAttempts !== undefined ? { remainingAttempts } : null;
    super("INVALID_PIN", message, HttpStatus.UNAUTHORIZED, details);
  }
}
export class WeakPinError extends AppError {
  constructor() {
    super("WEAK_PIN", "PIN format is too weak", HttpStatus.BAD_REQUEST);
  }
}
export class SamePinError extends AppError {
  constructor() {
    super("SAME_PIN", "New PIN must be different from current PIN", HttpStatus.BAD_REQUEST);
  }
}
export class PinMismatchError extends AppError {
  constructor() {
    super("PIN_MISMATCH", "PIN values do not match", HttpStatus.BAD_REQUEST);
  }
}
export class KycNotApprovedError extends AppError {
  constructor() {
    // Shared by PIN setup (global KYC gate) and transfer confirm (corridor KYC
    // gate) — keep the message context-neutral so neither caller misleads.
    super("KYC_NOT_APPROVED", "KYC approval is required", HttpStatus.FORBIDDEN);
  }
}
export class PinLockedError extends AppError {
  constructor() {
    super("PIN_LOCKED", "PIN is locked due to too many failed attempts", HttpStatus.TOO_MANY_REQUESTS);
  }
}
export class PinRequiredError extends AppError {
  constructor() {
    super("PIN_REQUIRED", "PIN is required for this request", HttpStatus.BAD_REQUEST);
  }
}
export class PinSetupRequiredError extends AppError {
  constructor() {
    super("PIN_SETUP_REQUIRED", "PIN setup is required before using this endpoint", HttpStatus.FORBIDDEN);
  }
}

// Beneficiary Errors
export class BeneficiaryNotFoundError extends AppError {
  constructor() {
    super("BENEFICIARY_NOT_FOUND", "Beneficiary not found", HttpStatus.NOT_FOUND);
  }
}
export class DuplicateBeneficiaryError extends AppError {
  constructor() {
    super("DUPLICATE_BENEFICIARY", "Beneficiary with same account already exists", HttpStatus.CONFLICT);
  }
}
export class InvalidNationalityError extends AppError {
  constructor() {
    super("INVALID_NATIONALITY_CODE", "Invalid nationality code", HttpStatus.BAD_REQUEST);
  }
}
export class BankInfoRequiredError extends AppError {
  constructor() {
    super("BANK_INFO_REQUIRED", "Bank code and name are required", HttpStatus.BAD_REQUEST);
  }
}
export class ActiveTransfersExistError extends AppError {
  constructor(activeTransfers: number) {
    super(
      "ACTIVE_TRANSFERS_EXIST",
      `There are ${activeTransfers} active transfers using this beneficiary.`,
      HttpStatus.BAD_REQUEST,
      // `activeTransfers` is the legacy field the client already reads;
      // `blockingTransfers` is the v1.3-precise alias (count of transactions in a
      // deletion-blocking status). Both carry the same value today.
      { activeTransfers, blockingTransfers: activeTransfers },
    );
  }
}

// Bank Account Masking / Full-View Errors
export class PrefundingBankAccountNotFoundError extends AppError {
  constructor() {
    super("PREFUNDING_BANK_ACCOUNT_NOT_FOUND", "Prefunding bank account not found", HttpStatus.NOT_FOUND);
  }
}
export class FullViewReasonRequiredError extends AppError {
  constructor() {
    super("FULL_VIEW_REASON_REQUIRED", "A reason is required to view the full account number", HttpStatus.BAD_REQUEST);
  }
}
