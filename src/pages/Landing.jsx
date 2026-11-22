import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserData } from "../services/userService";
import { getNavigationPathByRole } from "../services/authService";
import SignInModal from "../components/SignInModal";
import heroImage from "../assets/landing-hero.jpg";
import brandLogo from "../assets/laundrymate-logo.jpg";
import "../styles/Landing.css";

function Landing() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSignIn, setShowSignIn] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [downloadingApk, setDownloadingApk] = useState(false);

  const handleDownloadApk = async (event) => {
    event.preventDefault();
    if (downloadingApk) return;

    setDownloadingApk(true);
    try {
      const manifestRes = await fetch("/downloads/apk-manifest.json", {
        cache: "no-store",
      });
      if (!manifestRes.ok) {
        throw new Error("APK manifest unavailable");
      }
      const manifest = await manifestRes.json();
      const chunkList = Array.isArray(manifest.chunks) ? manifest.chunks : [];
      if (!chunkList.length) {
        throw new Error("No APK chunks found");
      }

      const buffers = await Promise.all(
        chunkList.map(async (chunkName) => {
          const res = await fetch(`/downloads/${chunkName}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch ${chunkName}`);
          }
          return res.arrayBuffer();
        })
      );

      const blob = new Blob(buffers, {
        type: "application/vnd.android.package-archive",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = manifest.fileName || "LaundryMate.apk";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (downloadError) {
      console.error("Chunked APK download failed, falling back:", downloadError);
      window.location.href =
        "https://raw.githubusercontent.com/johnmarkhtimtim-cmd/laundrysystem/main/public/downloads/laundrymate.apk";
    } finally {
      setDownloadingApk(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("signin") === "1") {
      setShowSignIn(true);
    }
  }, [searchParams]);

  // After idle logout, bring the user back to sign-in with a clear message
  useEffect(() => {
    if (sessionExpired && !user) {
      setShowSignIn(true);
      setSearchParams({ signin: "1" }, { replace: true });
    }
  }, [sessionExpired, user, setSearchParams]);

  useEffect(() => {
    const redirectUser = async () => {
      if (!user) return;

      try {
        const userData = await getUserData(user.uid);
        if (!userData) return;

        const path = getNavigationPathByRole(userData.role);
        if (path) navigate(path, { replace: true });
      } catch (error) {
        console.error("Error checking user role:", error);
      }
    };

    redirectUser();
  }, [user, navigate]);

  const openSignIn = () => {
    setShowSignIn(true);
    setSearchParams({ signin: "1" }, { replace: true });
  };

  const closeSignIn = () => {
    setShowSignIn(false);
    if (searchParams.get("signin")) {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="landing-page">
      {mobileNavOpen && (
        <button
          type="button"
          className="landing-nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <header className={`landing-nav ${mobileNavOpen ? "menu-open" : ""}`}>
        <Link to="/" className="landing-nav-brand">
          <img
            src={brandLogo}
            alt=""
            className="landing-nav-logo"
            width={36}
            height={36}
          />
          <span>LaundryMate</span>
        </Link>
        <nav
          className={`landing-nav-links ${mobileNavOpen ? "is-open" : ""}`}
          aria-label="Primary"
        >
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              setMobileNavOpen(false);
              document
                .getElementById("how-it-works")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            How it works
          </a>
          <a
            href="#services"
            onClick={(e) => {
              e.preventDefault();
              setMobileNavOpen(false);
              document
                .getElementById("services")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Services
          </a>
          <button
            type="button"
            className="landing-nav-login"
            onClick={() => {
              setMobileNavOpen(false);
              openSignIn();
            }}
          >
            Sign in
          </button>
          <Link
            to="/register"
            className="landing-nav-cta"
            onClick={() => setMobileNavOpen(false)}
          >
            Get started
          </Link>
        </nav>

        <button
          type="button"
          className="landing-menu-toggle"
          aria-label={
            mobileNavOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="landing-hero" aria-label="LaundryMate introduction">
        <div
          className="landing-hero-media"
          style={{ backgroundImage: `url(${heroImage})` }}
          role="img"
          aria-label="Fresh folded laundry ready for delivery"
        />
        <div className="landing-hero-veil" aria-hidden="true" />

        <div className="landing-hero-content">
          <p className="landing-brand">
            <img
              src={brandLogo}
              alt=""
              className="landing-brand-logo"
              width={72}
              height={72}
            />
            <span>LaundryMate</span>
          </p>
          <h1>Fresh laundry, picked up and returned.</h1>
          <p className="landing-hero-copy">
            Book a pickup, track every step, and get clean clothes back at your
            door — without the weekday laundry grind.
          </p>
          <div className="landing-hero-actions">
            <a
              className="btn-primary"
              href="/downloads/laundrymate.apk"
              download="LaundryMate.apk"
              onClick={handleDownloadApk}
            >
              {downloadingApk ? "Preparing APK..." : "Download Android App"}
            </a>
            <button type="button" className="btn-ghost" onClick={openSignIn}>
              Sign in
            </button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-process">
        <div className="landing-section-inner">
          <h2>How it works</h2>
          <p className="landing-section-lead">
            Four clear steps from booking to fresh clothes at your door.
          </p>

          <ol className="process-list">
            <li>
              <span className="process-num">01</span>
              <div>
                <h3>Book online</h3>
                <p>Choose your service and pickup window in a few taps.</p>
              </div>
            </li>
            <li>
              <span className="process-num">02</span>
              <div>
                <h3>We collect</h3>
                <p>A rider picks up your laundry from your doorstep.</p>
              </div>
            </li>
            <li>
              <span className="process-num">03</span>
              <div>
                <h3>We clean</h3>
                <p>Wash, dry, and fold with care — tracked in real time.</p>
              </div>
            </li>
            <li>
              <span className="process-num">04</span>
              <div>
                <h3>We deliver</h3>
                <p>Fresh laundry returned to you, ready to put away.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="services" className="landing-section landing-services">
        <div className="landing-section-inner">
          <h2>What we handle</h2>
          <p className="landing-section-lead">
            Everyday wash-and-fold plus the extras busy households need.
          </p>

          <ul className="service-rows">
            <li>
              <h3>Wash &amp; Fold</h3>
              <p>Everyday clothes cleaned, dried, and neatly folded.</p>
            </li>
            <li>
              <h3>Pickup &amp; Delivery</h3>
              <p>Door-to-door service with live booking status updates.</p>
            </li>
            <li>
              <h3>Secure Payments</h3>
              <p>Pay online with clear totals before you confirm.</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="landing-section landing-promise">
        <div className="landing-section-inner landing-promise-inner">
          <h2>Built for convenience you can trust</h2>
          <p>
            LaundryMate keeps bookings, rider assignment, and payments in one
            place — so you always know where your laundry is.
          </p>
          <Link to="/register" className="btn-primary">
            Create your account
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <strong>LaundryMate</strong>
          <p>Clean clothes. Easy booking. Better service.</p>
          <div className="landing-footer-links">
            <a
              href="/downloads/laundrymate.apk"
              download="LaundryMate.apk"
              onClick={handleDownloadApk}
            >
              {downloadingApk ? "Preparing APK..." : "Download APK"}
            </a>
            <button type="button" className="landing-footer-signin" onClick={openSignIn}>
              Sign in
            </button>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </footer>

      <SignInModal open={showSignIn} onClose={closeSignIn} />
    </div>
  );
}

export default Landing;
