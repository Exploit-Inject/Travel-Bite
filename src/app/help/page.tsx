import Link from "next/link";
import { ArrowRight } from "lucide-react";
export const metadata = { title: "Help & support" };
export default function Page() {
  const email = process.env.SUPPORT_EMAIL;
  return (
    <div className="container page-shell narrow-page">
      <div className="page-heading">
        <div className="eyebrow">A LITTLE HELP ALONG THE WAY</div>
        <h1>Let’s keep your journey smooth.</h1>
        <p>Answers for the moments between ordering and enjoying.</p>
      </div>
      <div className="help-grid">
        {[
          {
            title: "Where will my food arrive?",
            text: "Your food is delivered to your bus at the stop selected during checkout. Keep your bus and seat details accurate, and stay reachable on your verified mobile number.",
          },
          {
            title: "How do I track an order?",
            text: "Open My orders to see updates from the restaurant and delivery team. After dispatch, you can call the assigned delivery person using the number shown on your order.",
          },
          {
            title: "My bus is delayed. What now?",
            text: "Contact the assigned delivery person if their details are available. If your stop or arrival time changes, seek assistance before placing another order; existing order details do not update automatically.",
          },
          {
            title: "Can I cancel my order?",
            text: "Cash orders can be cancelled in My orders before the restaurant accepts them. For paid orders or orders already accepted, request assistance. Refund eligibility depends on the preparation status.",
          },
          {
            title: "My payment went through but the order is pending.",
            text: "Refresh My orders after a moment. Payment confirmation may arrive separately from your bank notification. Avoid making a second payment until the first payment’s status is clear.",
          },
          {
            title: "Dietary needs or allergies?",
            text: "Dish labels and descriptions come from the restaurant. Kitchen notes do not guarantee allergy-safe preparation. Confirm your requirements with the restaurant or support before placing an order.",
          },
        ].map((faq) => (
          <section className="panel" key={faq.title}>
            <h2>{faq.title}</h2>
            <p>{faq.text}</p>
          </section>
        ))}
      </div>
      <div className="panel help-notice">
        <h2>Need a hand with an order?</h2>
        <p className="muted small" style={{ marginTop: 10 }}>
          Keep your Travel Bite order number handy.
          {email ? (
            <>
              {" "}
              Email{" "}
              <a className="inline-link" href={`mailto:${email}`}>
                {email}
              </a>
              .
            </>
          ) : (
            " A support contact has not yet been published. Use the delivery contact in your order when available."
          )}
        </p>
        <Link className="text-button" href="/orders">
          Open my orders
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
