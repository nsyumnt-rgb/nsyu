/// Google OAuth (installed-app flow) credentials used ONLY for uploading
/// bill PDFs/images to Drive under your OWN Google account.
///
/// WHY THIS EXISTS
/// The service account (nsyu_service_account.json) has 0 storage quota of
/// its own — even when a folder is shared with it, any file it *creates*
/// counts against the service account's quota, not yours, and uploads fail
/// with "The user's Drive storage quota has been exceeded" or similar.
/// Google Sheets writes don't hit this problem, so Sheets keeps using the
/// service account — only file uploads use this OAuth flow instead.
///
/// ⚠️ SECURITY NOTE — same rule as the service account file:
/// NEVER commit this file to a public/shared git repo, and never publish a
/// build containing it to a public app store. This refresh token gives
/// standing access to write files into your Google Drive. If it's ever
/// exposed, revoke it immediately at:
/// https://myaccount.google.com/permissions
/// and generate a fresh one via the same OAuth consent flow.
class GoogleOAuthConfig {
  static const String clientId =
      '259060008857-dm73lb6et87ceb435am4o2oujrmpc4c8.apps.googleusercontent.com';
  static const String clientSecret = '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';
  static const String refreshToken =
      '1//04S4sUeV_ZOHoCgYIARAAGAQSNwF-L9Ir_g6G_wPN29BFnL_jmbmxOqog7dLVm6sWGqIp4xCa4EkH1F3U0qTsffF2uY-bVQzdkIc';
}
