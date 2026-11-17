import { notFound } from "next/navigation";
const documents: Record<
  string,
  { title: string; sections: { heading: string; text: string }[] }
> = {
  terms: {
    title: "Terms of service",
    sections: [
      {
        heading: "Ordering with Travel Bite",
        text: "Travel Bite connects bus passengers with restaurants serving selected stops. Availability depends on your route, restaurant hours, the selected stop, and preparation time. A restaurant must accept your order before preparation is confirmed.",
      },
      {
        heading: "Your journey details",
        text: "Provide an accurate mobile number, bus number, seat, current location, delivery stop, and expected arrival. Arrival times are supplied by you; the service does not provide automatic bus tracking. Contact the delivery team if your journey changes.",
      },
      {
        heading: "Prices and payment",
        text: "Prices are displayed in Indian rupees. Item totals and delivery charges are shown before placing an order. Online payments are processed by Razorpay when enabled. Cash orders are payable on delivery. A successful bank debit alone does not establish a confirmed order; check your order status.",
      },
      {
        heading: "Food information",
        text: "Restaurants supply menu descriptions, images, vegetarian labels, prices, and availability. Photos are illustrative. If you have allergies or dietary requirements, confirm suitability before ordering; kitchen notes cannot guarantee allergen-free food.",
      },
      {
        heading: "Service concerns",
        text: "Keep your order number and contact the published support channel or assigned delivery contact for problems. Cancellation and refund handling is described in the cancellation policy. These service terms do not limit rights available under applicable law.",
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    sections: [
      {
        heading: "Information used by the service",
        text: "Travel Bite stores your verified phone number, account name, authentication sessions, restaurant applications, order contents, payment references, and delivery details. Delivery details include the bus, seat, selected stop, expected arrival, and location you provide. Browser location is accessed only when you choose the location button.",
      },
      {
        heading: "Why this information is needed",
        text: "Account and delivery information is used to authenticate you, process orders, coordinate delivery, support restaurant operations, and investigate service or payment issues. Order details and your contact number are available to the relevant restaurant and authorised administrators.",
      },
      {
        heading: "Service providers",
        text: "The configured SMS provider receives the phone number and login message needed for verification. Razorpay processes online payments. Travel Bite stores provider references and payment states; it does not collect full card details. Review those providers’ policies when using their services.",
      },
      {
        heading: "Cookies and local preferences",
        text: "Authentication uses session cookies. Your browser may also save the food bag, journey preferences, and saved dishes in local storage. Clearing local storage removes those preferences. Logging out ends the current authentication session.",
      },
      {
        heading: "Your requests",
        text: "Use the published support contact for access, correction, or deletion requests. Some records may need to be retained for payment, dispute, or legal obligations. Before public launch, the operator must publish its identity, privacy contact, and retention schedule.",
      },
    ],
  },
  refunds: {
    title: "Cancellations & refunds",
    sections: [
      {
        heading: "Cash on delivery orders",
        text: "You may cancel a cash order from My orders while its status is Order placed. Once the restaurant accepts it, cancellation requires assistance and may depend on whether preparation has started.",
      },
      {
        heading: "Online payment orders",
        text: "Paid orders do not have automatic passenger cancellation. An authorised administrator can cancel and request a full refund before preparation starts. Orders already in preparation or dispatched require individual support review. Do not place a duplicate order to resolve a payment uncertainty.",
      },
      {
        heading: "Refund processing",
        text: "Approved online refunds are requested through Razorpay to the original payment method. Your order displays the refund status after provider confirmation. The payment provider and bank determine the processing time; Travel Bite does not promise an instant bank credit.",
      },
      {
        heading: "Missed stops, delays, and incorrect orders",
        text: "Contact support or the assigned delivery person as soon as a problem occurs. Provide the order number, the relevant bus details, and a description of the problem. Refund decisions require review of the order and delivery circumstances and must respect applicable consumer rights.",
      },
    ],
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  return { title: documents[document]?.title || "Page not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  const content = documents[document];
  if (!content) notFound();
  return (
    <div className="container page-shell legal-copy">
      <div className="page-heading">
        <div className="eyebrow">THE DETAILS THAT MATTER</div>
        <h1>{content.title}</h1>
      </div>
      <div className="info-box">
        Launch draft: the operator must review this policy and publish business
        and support details before accepting public orders.
      </div>
      {content.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <p>{s.text}</p>
        </section>
      ))}
    </div>
  );
}
