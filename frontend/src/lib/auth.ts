export function authErrorMessage(error: unknown): string {
  const value = error as {
    code?: string;
    message?: string;
    status?: number;
    name?: string;
  };
  const messages: Record<string, string> = {
    invalid_credentials:
      "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.",
    email_not_confirmed:
      "Email chưa được xác nhận. Vui lòng mở liên kết xác nhận trong hộp thư hoặc thư rác.",
    user_already_exists:
      "Email này đã có tài khoản. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.",
    email_exists:
      "Email này đã có tài khoản. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.",
    weak_password:
      "Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt.",
    same_password: "Mật khẩu mới phải khác mật khẩu hiện tại.",
    over_email_send_rate_limit:
      "Bạn đã yêu cầu email quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.",
    over_request_rate_limit:
      "Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.",
    otp_expired:
      "Liên kết xác nhận đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.",
    session_not_found: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    refresh_token_not_found:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    signup_disabled: "Đăng ký hiện đang tạm ngừng. Vui lòng liên hệ MediaHub.",
    user_banned: "Tài khoản đã bị tạm ngừng. Vui lòng liên hệ MediaHub.",
  };
  if (value?.code && messages[value.code]) return messages[value.code];
  if (value?.status === 429) return messages.over_request_rate_limit;
  if (value?.name === "AuthRetryableFetchError" || value instanceof TypeError)
    return "Không thể kết nối dịch vụ đăng nhập. Kiểm tra mạng và thử lại.";
  if (value?.name?.startsWith("Auth"))
    return "Không thể xác thực tài khoản. Vui lòng thử lại hoặc liên hệ MediaHub.";
  return value?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

export function readAuthCallback(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const read = (name: string) => hash.get(name) || url.searchParams.get(name);
  const type = read("type");
  return {
    passwordSetup: type === "recovery" || type === "invite",
    error: read("error")
      ? authErrorMessage({ code: read("error_code") || "otp_expired" })
      : "",
  };
}

export function registrationDetails(name: string, organization: string) {
  const full_name = name.trim(),
    company = organization.trim();
  if (!full_name || full_name.length > 150)
    throw new Error("Nhập họ và tên từ 1 đến 150 ký tự.");
  if (company.length > 200) throw new Error("Tên công ty tối đa 200 ký tự.");
  return { full_name, organization: company };
}
