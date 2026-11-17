import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
export default function NotFound() {
  return (
    <div className="container page-shell">
      <div className="empty-state">
        <MapPin size={44} />
        <h1>This stop isn’t on the route.</h1>
        <p>
          The page you’re looking for may have moved. There’s still good food
          ahead.
        </p>
        <Link href="/" className="button">
          Back to Travel Bite
          <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
