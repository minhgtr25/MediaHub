import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicCreator } from "./creator-profile.types";

export function MessageCreator({
  creator,
  compact = false,
}: {
  creator: PublicCreator;
  compact?: boolean;
}) {
  return (
    <div className="message-action">
      <Link
        className="btn btn-primary"
        to={`/request-project?creator=${creator.id}`}
        aria-label={`Yêu cầu tư vấn với ${creator.display_name}`}
      >
        {compact ? "Yêu cầu tư vấn" : "Yêu cầu tư vấn Creator này"}
        <ArrowRight size={15} />
      </Link>
      {!compact && (
        <small>
          Staff sẽ tư vấn và xác nhận lịch với Creator trong hội thoại dịch vụ.
        </small>
      )}
    </div>
  );
}
