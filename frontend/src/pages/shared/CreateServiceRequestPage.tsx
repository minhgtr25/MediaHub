import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Info } from "lucide-react";
import { ActionForm, Field, Page, State, money } from "../../components/ui";
import { InlineCreatorProfile } from "../../components/InlineCreatorProfile";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import type { ServicePackage } from "../../types/requests";

type Service = { id: string; name: string; slug: string };
type ServiceDetail = Service & { description: string | null; starting_price: number | null; estimated_days: number | null; features: string[]; deliverables: string[] };
type Creator = { id: string; display_name: string; slug: string; title: string };
type Collection<T> = { items: T[]; total: number };

export function CreateRequest() {
  const [params] = useSearchParams(), navigate = useNavigate();
  const services = useApi<Collection<Service>>("/public/services?limit=100");
  const [service, setService] = useState(params.get("service") || ""), [packageId, setPackage] = useState(params.get("package") || "");
  const [preference, setPreference] = useState(params.get("creator") ? "PREFERRED" : "ADVICE"), [creatorId, setCreator] = useState(params.get("creator") || "");
  const [creatorSearch, setCreatorSearch] = useState(""), [debouncedSearch, setDebouncedSearch] = useState("");
  const [chosenCreator, setChosenCreator] = useState<Creator | null>(null);
  const [tab, setTab] = useState<"guide" | "service">("guide"), [key] = useState(() => crypto.randomUUID());
  const packages = useApi<ServicePackage[]>(service ? `/public/services/${encodeURIComponent(service)}/packages` : null);
  const creators = useApi<Collection<Creator>>(preference === "PREFERRED" ? `/public/creators/options?${new URLSearchParams({ search: debouncedSearch, ...(creatorId ? { include_id: creatorId } : {}) })}` : null);
  useEffect(() => { const timeout = window.setTimeout(() => setDebouncedSearch(creatorSearch.trim()), 250); return () => window.clearTimeout(timeout); }, [creatorSearch]);
  useEffect(() => { if (!service && services.data?.items[0]) setService(services.data.items[0].id); }, [services.data, service]);
  useEffect(() => {
    const next = creators.data?.items.find(creator => creator.id === creatorId);
    if (next) setChosenCreator(next);
  }, [creators.data, creatorId]);
  const selectedService = services.data?.items.find(item => item.id === service);
  const selectedPackage = packages.data?.find(item => item.id === packageId);
  const selectedCreator = preference === "PREFERRED" && chosenCreator?.id === creatorId ? chosenCreator : null;
  const details = useApi<ServiceDetail>(tab === "service" && selectedService ? `/public/services/${encodeURIComponent(selectedService.slug)}` : null);
  const ready = !!selectedService && !services.loading && !services.error && !packages.loading && !packages.error && (preference !== "PREFERRED" || !!creators.data && !creators.loading && !creators.error);

  return <Page title="Gửi yêu cầu dịch vụ">
    <p className="request-create-intro">Chia sẻ nhu cầu để Staff tư vấn dịch vụ và đội Creator phù hợp. Bạn sẽ theo dõi toàn bộ quá trình trong một hội thoại.</p>
    <div className="request-create-layout">
      <section className="panel request-create" aria-label="Thông tin yêu cầu">
        <ActionForm label="Gửi yêu cầu" showSubmit={false} showSuccess={false} onSubmit={async form => {
          if (!ready) throw new Error("Thông tin dịch vụ chưa tải xong. Hãy thử tải lại vùng dữ liệu đang báo lỗi.");
          if (packageId && !selectedPackage) throw new Error("Gói đã chọn không còn được cung cấp. Hãy chọn gói khác hoặc cần tư vấn.");
          if (preference === "PREFERRED" && !creators.data?.items.some(item => item.id === creatorId)) throw new Error("Vui lòng chọn Creator đang nhận yêu cầu hoặc chuyển sang cần tư vấn.");
          const amount = (name: string) => String(form.get(name) || "").trim() ? Number(form.get(name)) : null;
          const minimum = amount("budget_min"), maximum = amount("budget_max");
          if (minimum !== null && maximum !== null && maximum < minimum) throw new Error("Ngân sách tối đa phải từ ngân sách tối thiểu trở lên.");
          const result = await post("/requests", { service_id: service, package_id: packageId || null, title: form.get("title"), brief: form.get("brief"), budget_min: minimum, budget_max: maximum, deadline: form.get("deadline") || null, reference_urls: [], creator_preference: preference, preferred_creator_id: preference === "PREFERRED" ? creatorId : null, idempotency_key: key });
          navigate(`/customer/requests/${result.id}`, { replace: true });
        }}>
          <h2>Dịch vụ bạn quan tâm</h2>
          <div className="request-form-grid">
            <div className="field"><label htmlFor="request-service">Dịch vụ</label><select id="request-service" required value={service} disabled={services.loading || !!services.error} onChange={event => { setService(event.target.value); setPackage(""); }}><option value="">{services.loading ? "Đang tải dịch vụ…" : "Chọn dịch vụ"}</option>{services.data?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field"><label htmlFor="request-package">Gói dịch vụ</label><select id="request-package" value={packageId} disabled={!selectedService || packages.loading || !!packages.error} onChange={event => setPackage(event.target.value)}><option value="">{packages.loading && service ? "Đang tải gói…" : "Cần tư vấn gói phù hợp"}</option>{packages.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          </div>
          {services.error && <p className="error" role="alert">{services.error} <button type="button" className="btn btn-ghost" onClick={services.reload}>Tải lại dịch vụ</button></p>}
          {!services.loading && !services.error && services.data && !services.data.items.length && <p>Chưa có dịch vụ đang cung cấp. <Link to="/contact">Liên hệ MediaHub</Link></p>}
          {packages.error && <p className="error" role="alert">{packages.error} <button type="button" className="btn btn-ghost" onClick={packages.reload}>Tải lại gói</button></p>}
          {selectedPackage && <div className="request-package-preview"><strong>{selectedPackage.name}</strong><p>{selectedPackage.description}</p>{selectedPackage.starting_price !== null && <p>Giá tham khảo từ {money(selectedPackage.starting_price)}. Staff xác nhận báo giá sau tư vấn.</p>}</div>}
          <h2>Mô tả nhu cầu</h2>
          <Field name="title" label="Tiêu đề yêu cầu" maxLength={200}/>
          <Field name="brief" label="Mục tiêu, đối tượng, phạm vi và sản phẩm mong muốn" type="textarea"/>
          <div className="request-form-grid">
            <Field name="budget_min" label="Ngân sách từ (VND, có thể bỏ trống)" type="number" required={false}/>
            <Field name="budget_max" label="Ngân sách tối đa (VND, có thể bỏ trống)" type="number" required={false}/>
            <Field name="deadline" label="Ngày mong muốn nhận bàn giao" type="date" required={false}/>
            <div className="field"><label htmlFor="creator-preference">Lựa chọn Creator</label><select id="creator-preference" value={preference} onChange={event => setPreference(event.target.value)}><option value="ADVICE">MediaHub tư vấn Creator phù hợp</option><option value="PREFERRED">Tôi có Creator ưu tiên</option></select></div>
          </div>
          {preference === "PREFERRED" && <div className="request-form-grid">
            <div className="field"><label htmlFor="creator-search">Tìm theo tên Creator</label><input id="creator-search" value={creatorSearch} maxLength={100} onChange={event => setCreatorSearch(event.target.value)}/></div>
            <div className="field"><label htmlFor="preferred-creator">Creator ưu tiên</label><select id="preferred-creator" required value={creatorId} disabled={creators.loading || !!creators.error} onChange={event => setCreator(event.target.value)}><option value="">{creators.loading ? "Đang tìm Creator…" : "Chọn Creator"}</option>{creators.data?.items.map(item => <option value={item.id} key={item.id}>{item.display_name} · {item.title}</option>)}</select></div>
            {creators.error && <p className="error" role="alert">{creators.error} <button type="button" className="btn btn-ghost" onClick={creators.reload}>Thử lại</button></p>}
            <p className="muted request-form-full">Staff sẽ xác nhận lịch và phần việc với Creator trước khi chốt đội thực hiện. Bạn có thể chọn thêm thành viên khi tư vấn.</p>
          </div>}
          <div className="request-submit"><p>Gửi yêu cầu chưa tạo đơn hàng hoặc phát sinh thanh toán.</p><button type="submit" className="btn btn-primary" disabled={!ready}>Gửi yêu cầu tư vấn →</button></div>
        </ActionForm>
      </section>
      <aside className="panel request-context" aria-label="Hướng dẫn và thông tin dịch vụ">
        <div className="request-context-tabs" role="tablist" aria-label="Thông tin hỗ trợ" onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault(); const next = event.key === "Home" ? "guide" : event.key === "End" ? "service" : tab === "guide" ? "service" : "guide";
            setTab(next); document.getElementById(`request-context-${next}`)?.focus();
          }
        }}>
          <button type="button" role="tab" id="request-context-guide" aria-selected={tab === "guide"} aria-controls="request-guide-panel" tabIndex={tab === "guide" ? 0 : -1} onClick={() => setTab("guide")}><BookOpen size={16}/> Hướng dẫn</button>
          <button type="button" role="tab" id="request-context-service" aria-selected={tab === "service"} aria-controls="request-service-panel" tabIndex={tab === "service" ? 0 : -1} onClick={() => setTab("service")}><Info size={16}/> Thông tin dịch vụ</button>
        </div>
        <div id="request-guide-panel" role="tabpanel" aria-labelledby="request-context-guide" hidden={tab !== "guide"} tabIndex={0}>
          <h2>Để Staff tư vấn sát nhu cầu</h2>
          <ol className="request-guide-steps"><li><b>Chọn dịch vụ</b><p>Chưa rõ gói nào phù hợp? Giữ lựa chọn cần tư vấn.</p></li><li><b>Chia sẻ mục tiêu</b><p>Nêu khách hàng hướng tới, sản phẩm cần nhận và nơi sử dụng. Ví dụ: video giới thiệu sản phẩm để đăng mạng xã hội.</p></li><li><b>Dự kiến ngân sách và thời gian</b><p>Có thể để trống ngân sách. Ngày mong muốn giúp Staff xác nhận lịch thực hiện.</p></li><li><b>Gửi yêu cầu và trao đổi</b><p>Hệ thống phân Staff đang rảnh. Người phụ trách tư vấn Creator, phạm vi, báo giá và hợp đồng trong cùng một hội thoại.</p></li></ol>
          <p className="request-context-note">Sau khi thống nhất và xác nhận hợp đồng, bạn đặt cọc tối thiểu 30%. Bản nghiệm thu có watermark; bản hoàn thiện được bàn giao sau khi Staff xác nhận thu đủ tiền.</p>
        </div>
        <div id="request-service-panel" role="tabpanel" aria-labelledby="request-context-service" hidden={tab !== "service"} tabIndex={0}>
          {!selectedService ? <p>Chọn dịch vụ ở biểu mẫu để xem mô tả và đầu ra tại đây.</p> : <State query={details}>{details.data && <><h2>{details.data.name}</h2><p className="preserve-lines">{details.data.description || "Staff sẽ tư vấn phạm vi phù hợp với yêu cầu của bạn."}</p>{details.data.starting_price !== null && <p>Giá tham khảo từ <b>{money(details.data.starting_price)}</b></p>}{details.data.estimated_days !== null && <p>Thời gian tham khảo: {details.data.estimated_days} ngày.</p>}{!!details.data.deliverables?.length && <><h3>Đầu ra tham khảo</h3><ul>{details.data.deliverables.map(item => <li key={item}>{item}</li>)}</ul></>}{!!details.data.features?.length && <><h3>Phạm vi dịch vụ</h3><ul>{details.data.features.map(item => <li key={item}>{item}</li>)}</ul></>}</>}</State>}
          {selectedPackage && <section className="request-context-section"><h3>Gói đang chọn: {selectedPackage.name}</h3><p>{selectedPackage.description}</p><ul>{selectedPackage.deliverables.map(item => <li key={item}>{item}</li>)}</ul></section>}
          {selectedCreator && <section className="request-context-section"><h3>Creator ưu tiên</h3><b>{selectedCreator.display_name}</b><p>{selectedCreator.title}</p><InlineCreatorProfile key={selectedCreator.slug} slug={selectedCreator.slug} summary="Xem hồ sơ và sản phẩm Creator"/></section>}
          <p className="muted">Thông tin tham khảo; Staff sẽ thống nhất đầu ra, lịch và giá chính thức với bạn.</p>
        </div>
      </aside>
    </div>
  </Page>;
}
