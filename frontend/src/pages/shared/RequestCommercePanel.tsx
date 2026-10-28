import { Link } from "react-router-dom";
import { State, Status } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { isCustomerRole } from "../../lib/permissions";
import { ordersHome } from "../../lib/commerce";
import type { RequestCommerce } from "../../types/commerce";
import { CreatorTeamPanel, type CreatorTeam } from "./CreatorTeamPanel";
import { ProposalBuilder, ProposalCard } from "./RequestProposalPanel";
import { QuoteBuilder, QuoteCard } from "./RequestQuotePanel";

export function RequestCommercePanel({
  id,
  serviceId,
  query,
  team,
  onChanged,
}: {
  id: string;
  serviceId: string;
  query: ReturnType<typeof useApi<RequestCommerce>>;
  team: ReturnType<typeof useApi<CreatorTeam>>;
  onChanged: () => void;
}) {
  const { role } = useAuth(),
    customer = isCustomerRole(role),
    data = query.data;
  const closed =
    data && ["CANCELLED", "CONVERTED"].includes(data.request_status);
  const canPropose =
    !customer &&
    data &&
    [
      "CONSULTING",
      "WAITING_CUSTOMER",
      "CREATOR_SELECTION",
      "QUOTE_PREPARING",
    ].includes(data.request_status) &&
    !data.selection_locked;
  const draft = data?.quotes.find((q) => q.status === "DRAFT");
  return (
    <section className="commerce-panel" aria-label="Đề xuất và báo giá">
      <State query={query}>
        {data && (
          <>
            {data.order && (
              <div className="panel order-banner">
                <div>
                  <strong>Đơn dịch vụ đã tạo</strong>
                  <p>{data.order.order_number}</p>
                  <Status value={data.order.status} />
                </div>
                <Link
                  className="btn btn-primary"
                  to={`${ordersHome(role)}/${data.order.id}`}
                >
                  Xem đơn dịch vụ →
                </Link>
              </div>
            )}
            <section className="panel">
              <h2>Creator được đề xuất</h2>
              <p className="muted">
                So sánh phương án, lưu vào danh sách cân nhắc và chọn creator để
                chuẩn bị báo giá. Giá dự kiến cần được xác nhận trong báo giá.
              </p>
              {!data.proposals.length && (
                <p className="muted">
                  {customer
                    ? "Người phụ trách sẽ đề xuất creator sau khi làm rõ brief."
                    : "Chưa gửi đề xuất creator cho yêu cầu này."}
                </p>
              )}
              {data.selection_locked && !closed && (
                <p className="muted">
                  Lựa chọn creator đã gắn với báo giá và được giữ nguyên trong
                  lịch sử phiên bản.
                </p>
              )}
              <div className="proposal-grid">
                {data.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    id={id}
                    customer={customer}
                    locked={!!closed || data.selection_locked}
                    selected={
                      !!team.data?.selected.some(
                        (s) => s.creator_id === proposal.creator_id,
                      )
                    }
                    onChanged={onChanged}
                  />
                ))}
              </div>
              {canPropose && (
                <details className="commerce-editor">
                  <summary>Gửi thêm đề xuất creator</summary>
                  <ProposalBuilder id={id} onChanged={onChanged} />
                </details>
              )}
            </section>
            <CreatorTeamPanel
              id={id}
              query={team}
              locked={!!closed || data.selection_locked}
              onChanged={onChanged}
            />
            <section className="panel">
              <h2>Báo giá &amp; phiên bản</h2>
              <p className="muted">
                Bản đã gửi được giữ nguyên. Mỗi lần chỉnh sau phản hồi của khách
                sẽ tạo một phiên bản mới.
              </p>
              {!data.quotes.length && (
                <p className="muted">
                  {customer
                    ? "Bạn sẽ nhận báo giá tại đây sau khi chọn creator."
                    : "Chọn creator cùng khách hàng trước khi chuẩn bị báo giá."}
                </p>
              )}
              {data.quotes.map((quote, index) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  id={id}
                  customer={customer}
                  active={!closed && index === 0}
                  onChanged={onChanged}
                />
              ))}
              {!customer &&
                ["QUOTE_PREPARING", "QUOTE_REVISION"].includes(
                  data.request_status,
                ) && (
                  <details className="commerce-editor" open>
                    <summary>
                      {draft
                        ? `Sửa bản nháp v${draft.version}`
                        : "Chuẩn bị phiên bản báo giá mới"}
                    </summary>
                    <QuoteBuilder
                      key={draft?.id ?? "new"}
                      id={id}
                      serviceId={serviceId}
                      draft={draft ?? data.quotes[0]}
                      onChanged={onChanged}
                    />
                  </details>
                )}
            </section>
          </>
        )}
      </State>
    </section>
  );
}
export function CommerceMessageLink({
  kind,
  metadata,
}: {
  kind: string;
  metadata: Record<string, unknown>;
}) {
  const { role } = useAuth();
  if (
    (typeof metadata.replacement_id === "string" ||
      typeof metadata.delay_id === "string") &&
    (!["CREATOR", "STUDENT_CREATOR"].includes(role || "") ||
      String(metadata.event || "").startsWith("PRODUCTION_DELAY_") ||
      metadata.event === "CREATOR_REPLACEMENT_COMPLETED")
  )
    return (
      <a className="btn btn-ghost" href="#execution">
        Xem điều phối &amp; lịch ↓
      </a>
    );
  if (
    typeof metadata.variation_id === "string" &&
    String(metadata.event || "").startsWith("ORDER_VARIATION_") &&
    !["CREATOR", "STUDENT_CREATOR"].includes(role || "")
  )
    return (
      <a className="btn btn-ghost" href={`#variation-${metadata.variation_id}`}>
        Xem phụ lục phát sinh ↓
      </a>
    );
  if (kind === "CREATOR_PROPOSAL" && typeof metadata.proposal_id === "string")
    return (
      <a className="btn btn-ghost" href={`#proposal-${metadata.proposal_id}`}>
        Xem đề xuất creator ↓
      </a>
    );
  if (kind === "QUOTE" && typeof metadata.quote_id === "string")
    return (
      <a className="btn btn-ghost" href={`#quote-${metadata.quote_id}`}>
        Xem báo giá và điều kiện ↓
      </a>
    );
  if (kind === "ORDER" && typeof metadata.order_id === "string")
    return (
      <Link
        className="btn btn-primary"
        to={`${ordersHome(role)}/${metadata.order_id}`}
      >
        Mở đơn dịch vụ →
      </Link>
    );
  if (
    kind === "CONTRACT" &&
    typeof metadata.order_id === "string" &&
    typeof metadata.contract_id === "string"
  )
    return (
      <Link
        className="btn btn-primary"
        to={`${ordersHome(role)}/${metadata.order_id}#contract-${metadata.contract_id}`}
      >
        Xem điều khoản hợp đồng →
      </Link>
    );
  if (
    kind === "PAYMENT" &&
    typeof metadata.order_id === "string" &&
    typeof metadata.payment_id === "string"
  )
    return (
      <Link
        className="btn btn-primary"
        to={`${ordersHome(role)}/${metadata.order_id}#payment-${metadata.payment_id}`}
      >
        Xem yêu cầu thanh toán →
      </Link>
    );
  if (["CREATOR", "STUDENT_CREATOR"].includes(role || "")) return null;
  if (kind === "PROJECT" && typeof metadata.order_id === "string")
    return (
      <Link
        className="btn btn-primary"
        to={`${ordersHome(role)}/${metadata.order_id}#production`}
      >
        Xem kế hoạch sản xuất →
      </Link>
    );
  return null;
}
