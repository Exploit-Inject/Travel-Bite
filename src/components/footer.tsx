import Link from "next/link";
import { ArrowUpRight, Heart, MapPin } from "lucide-react";
import { Logo } from "./header";
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Logo light />
            <p>
              A good journey deserves good food.
              <br />
              Fresh meals. Familiar flavours. Delivered en route.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h3>On the road</h3>
              <Link href="/menu">Explore menu</Link>
              <Link href="/orders">Track your order</Link>
              <Link href="/#how-it-works">How it works</Link>
            </div>
            <div>
              <h3>Grow with us</h3>
              <Link href="/partner">
                Restaurant partners
                <ArrowUpRight size={13} />
              </Link>
              <Link href="/partner/dashboard">Partner dashboard</Link>
              <Link href="/help">Help & support</Link>
            </div>
            <div>
              <h3>The little details</h3>
              <Link href="/legal/terms">Terms of service</Link>
              <Link href="/legal/privacy">Privacy policy</Link>
              <Link href="/legal/refunds">Cancellations & refunds</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Travel Bite. All rights reserved.
          </span>
          <span>
            Made for the journey
            <Heart size={13} />
          </span>
          <span>
            <MapPin size={13} />
            India
          </span>
        </div>
      </div>
    </footer>
  );
}
