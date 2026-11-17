"use client";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BusFront,
  ChefHat,
  Check,
  Clock3,
  Leaf,
  MapPin,
  MoveUpRight,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { useApp } from "./app-provider";
import { FoodMenu } from "./food-menu";

export function Home() {
  const { editJourney, journey, catalog } = useApp();
  const stop = catalog.routes
    .flatMap((r) => r.stops)
    .find((s) => s.id === journey?.stopId);
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span />
            GOOD FOOD. EVERY MILE.
          </span>
          <h1>
            Your journey.
            <br />A delicious
            <br />
            <span>upgrade.</span>
            <svg
              className="hero-underline"
              viewBox="0 0 290 14"
              aria-hidden="true"
            >
              <path
                d="M3 11C70 1 186-2 286 8"
                stroke="currentColor"
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p>
            Skip the roadside rush. Get fresh, delicious meals
            <br className="desktop-break" /> from local restaurants, delivered
            at your next bus stop.
          </p>
          <div className="hero-buttons">
            <button className="button hero-button" onClick={editJourney}>
              Find food on my route
              <ArrowRight size={19} />
            </button>
            <a className="hero-how" href="#how-it-works">
              <span>
                <ArrowDown size={18} />
              </span>
              How it works
            </a>
          </div>
          <div className="hero-assurances">
            <span>
              <BadgeCheck size={17} />
              Freshly prepared
            </span>
            <span>
              <Clock3 size={17} />
              Delivered en route
            </span>
            <span>
              <ShieldCheck size={17} />
              Secure payments
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-bg">
            <div className="hero-dots" />
            <span className="hero-food-label">
              a little taste of
              <br />
              <em>home.</em>
            </span>
            <img
              className="hero-food"
              src="/images/hero-biryani.jpg"
              alt="Fresh paneer curry served with basmati rice and flatbread"
              width={850}
              height={850}
              fetchPriority="high"
            />
            <div className="floating-fresh">
              <span>
                <Leaf size={19} />
              </span>
              <div>
                Made fresh.<small>For your journey.</small>
              </div>
              <Sparkles size={17} />
            </div>
            <div className="hero-stamp">
              <UtensilsCrossed size={22} />
              <span>
                HAPPY TUMMY
                <br />
                HAPPY JOURNEY
              </span>
            </div>
            <div className="floating-delivery">
              <span className="delivery-icon">
                <BusFront size={26} />
              </span>
              <div>
                <span className="delivery-kicker">NEXT STOP</span>
                <strong>{stop?.city || "Great food."}</strong>
                <span>Your seat. Your meal. Your moment.</span>
              </div>
              <span className="delivery-check">
                <Check size={16} />
              </span>
            </div>
            <svg
              className="hero-route"
              viewBox="0 0 500 120"
              aria-hidden="true"
            >
              <path
                d="M20 20C160 10 110 120 250 80S380 0 480 50"
                fill="none"
                stroke="#efaa6a"
                strokeWidth="2"
                strokeDasharray="5 7"
              />
            </svg>
          </div>
        </div>
      </section>
      <section
        className="journey-bar container"
        aria-label="Set delivery journey"
      >
        <div className="journey-bar-intro">
          <span className="journey-bus">
            <BusFront size={24} />
          </span>
          <div>
            <h2>Hungry on the highway?</h2>
            <p>Let’s make your next stop delicious.</p>
          </div>
        </div>
        <button onClick={editJourney} className="journey-field">
          <span className="field-label">YOUR BUS</span>
          <span>
            <BusFront size={16} />
            {journey?.busNumber || "Enter bus number"}
          </span>
        </button>
        <button onClick={editJourney} className="journey-field">
          <span className="field-label">DELIVERY STOP</span>
          <span>
            <MapPin size={16} />
            {stop?.city || "Select upcoming stop"}
          </span>
        </button>
        <button className="button journey-find" onClick={editJourney}>
          {journey ? "Update journey" : "Find my food"}
          <ArrowRight size={18} />
        </button>
      </section>
      <div className="trust-strip container">
        <span>
          Better bites.
          <br />
          <strong>Happier miles.</strong>
        </span>
        <div>
          <ChefHat size={24} />
          <span>
            Fresh from
            <br />
            <strong>local kitchens</strong>
          </span>
        </div>
        <div>
          <ShoppingBag size={24} />
          <span>
            Thoughtfully packed
            <br />
            <strong>for your journey</strong>
          </span>
        </div>
        <div>
          <QrCode size={24} />
          <span>
            Scan. Order. Enjoy.
            <br />
            <strong>No app needed</strong>
          </span>
        </div>
        <div>
          <ShieldCheck size={24} />
          <span>
            Your food, your way
            <br />
            <strong>UPI, cards or cash</strong>
          </span>
        </div>
      </div>
      <FoodMenu />
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-heading centered">
            <div>
              <div className="eyebrow">LESS HASSLE. MORE HAPPY.</div>
              <h2>From hungry to happy, in three stops.</h2>
              <p>You enjoy the view. We’ll take care of the food.</p>
            </div>
          </div>
          <div className="how-grid">
            {[
              {
                n: "01",
                icon: QrCode,
                title: "Scan or set your journey",
                body: "Scan the QR near your seat, or enter your bus details and upcoming stop.",
              },
              {
                n: "02",
                icon: UtensilsCrossed,
                title: "Pick your kind of delicious",
                body: "Explore local kitchens, fill your bag, and pay online or choose cash on delivery.",
              },
              {
                n: "03",
                icon: BusFront,
                title: "Good food meets your bus",
                body: "Your order is prepared fresh and brought to your bus at your selected stop.",
              },
            ].map(({ n, icon: Icon, title, body }) => (
              <article className="how-card" key={n}>
                <div className="how-card-top">
                  <span className="how-icon">
                    <Icon size={29} />
                  </span>
                  <span className="step-number">{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="partner-banner container">
        <div className="partner-banner-art">
          <ChefHat size={64} />
          <span className="art-spark-one">✦</span>
          <span className="art-spark-two">✧</span>
          <span className="art-route" />
        </div>
        <div>
          <div className="eyebrow">YOUR KITCHEN. THEIR JOURNEY.</div>
          <h2>Cook up your next chapter.</h2>
          <p>
            Bring your food to hungry travellers along the way.
            <br />
            Join Travel Bite as a restaurant partner.
          </p>
        </div>
        <Link href="/partner" className="button button-dark">
          Let’s partner up
          <ArrowUpRight size={19} />
        </Link>
      </section>
      <section className="closing-line container">
        <span className="closing-dash" />
        <BusFront size={22} />
        <p>
          Wherever the road takes you,<em> eat well along the way.</em>
        </p>
        <span className="closing-dash" />
      </section>
    </>
  );
}
