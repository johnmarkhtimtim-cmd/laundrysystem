import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/CustomerDashboard.css";

const stats = [
  {
    label: "Active orders",
    value: "04",
    change: "+2 this week",
    tone: "blue",
  },
];

const recentOrders = [
  {
    id: "LM-1001",
    name: "Premium Wash & Fold",
    status: "In progress",
    timing: "Pickup 3:30 PM",
  },
  {
    id: "LM-1002",
    name: "Bedding Refresh",
    status: "Ready for pickup",
    timing: "Pickup tomorrow",
  },
  {
    id: "LM-1003",
    name: "Dry Cleaning",
    status: "Scheduled",
    timing: "Pickup Friday",
  },
];

const services = [
  {
    title: "Wash & Fold",
    description: "Fast, hygienic, and neatly packed.",
    icon: "🧺",
  },
  {
    title: "Dry Cleaning",
    description: "Delicate garments handled with care.",
    icon: "👔",
  },
  {
    title: "Ironing",
    description: "Crisp finish for work essentials.",
    icon: "✨",
  },
  {
    title: "Bedding Care",
    description: "Deep clean for comfort and freshness.",
    icon: "🛏️",
  },
];

function CustomerDashboard() {
  const navigate = useNavigate();

  // =====================================
  // BOOK SERVICE
  // =====================================

  const handleBookService = () => {
    navigate("/customer/booknow");
  };

  // =====================================
  // VIEW ORDERS
  // =====================================

  const handleViewOrders = () => {
    navigate("/customer/mybookings");
  };

  // =====================================
  // OPEN ORDER
  // =====================================

  const handleOrderClick = (order) => {
    navigate(`/customer/booknow${order.id}`);
  };

  // =====================================
  // SELECT SERVICE
  // =====================================

  const handleServiceClick = (service) => {
    navigate(
      `/customer/booknow?service=${encodeURIComponent(service.title)}`
    );
  };

  return (
    <div className="customer-dashboard">

      {/* =====================================
          HERO
      ===================================== */}

      <section className="dashboard-hero">

        <div className="hero-content">

          <div className="welcome-icon">
            👋
          </div>

          <div className="hero-text">

            <p className="eyebrow">
              CUSTOMER DASHBOARD
            </p>

            <h1>
              Welcome back!
            </h1>

            <p className="hero-description">
              Keep your laundry fresh, organized, and effortless.
            </p>

          </div>

        </div>

        <button
          type="button"
          className="primary-btn"
          onClick={handleBookService}
        >
          <span>＋</span>
          <span>Book a service</span>
        </button>

      </section>


      {/* =====================================
          STATISTICS
      ===================================== */}

      <section className="stats-grid">

        {stats.map((stat) => (

          <div
            key={stat.label}
            className={`stat-card ${stat.tone}`}
          >

            <div className="stat-top">

              <div>
                <span className="stat-label">
                  {stat.label}
                </span>
              </div>

              <div className="stat-icon">
                🧺
              </div>

            </div>

            <div className="stat-bottom">

              <strong className="stat-value">
                {stat.value}
              </strong>

              <span className="stat-change">
                {stat.change}
              </span>

            </div>

          </div>

        ))}

      </section>


      {/* =====================================
          MAIN DASHBOARD
      ===================================== */}

      <section className="dashboard-grid">

        {/* =====================================
            RECENT ORDERS
        ===================================== */}

        <div className="panel panel-large">

          <div className="panel-header">

            <div>

              <p className="panel-eyebrow">
                ORDERS
              </p>

              <h3>
                Recent orders
              </h3>

              <p className="panel-description">
                Track your latest laundry bookings.
              </p>

            </div>

            <button
              type="button"
              className="text-btn"
              onClick={handleViewOrders}
            >
              View all
              <span>→</span>
            </button>

          </div>


          <div className="orders-list">

            {recentOrders.map((order, index) => {

              let statusClass = "";

              if (order.status === "In progress") {
                statusClass = "in-progress";
              }

              if (order.status === "Ready for pickup") {
                statusClass = "ready-for-pickup";
              }

              if (order.status === "Scheduled") {
                statusClass = "scheduled";
              }

              return (

                <button
                  key={order.id}
                  type="button"
                  className="order-item"
                  onClick={() => handleOrderClick(order)}
                >

                  <div className="order-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="order-info">

                    <h4>
                      {order.name}
                    </h4>

                    <p>
                      🕒 {order.timing}
                    </p>

                  </div>

                  <span
                    className={`status-pill ${statusClass}`}
                  >
                    <span className="status-dot"></span>
                    {order.status}
                  </span>

                  <span className="order-arrow">
                    →
                  </span>

                </button>

              );

            })}

          </div>

        </div>


        {/* =====================================
            QUICK SERVICES
        ===================================== */}

        <div className="panel panel-side">

          <div className="panel-header">

            <div>

              <p className="panel-eyebrow">
                SERVICES
              </p>

              <h3>
                Quick services
              </h3>

              <p className="panel-description">
                Choose a service to start your booking.
              </p>

            </div>

          </div>


          <div className="service-list">

            {services.map((service) => (

              <button
                key={service.title}
                type="button"
                className="service-item"
                onClick={() => handleServiceClick(service)}
              >

                <div className="service-icon">
                  {service.icon}
                </div>

                <div className="service-content">

                  <h4>
                    {service.title}
                  </h4>

                  <p>
                    {service.description}
                  </p>

                </div>

                <span className="service-arrow">
                  →
                </span>

              </button>

            ))}

          </div>

        </div>

      </section>


    </div>
  );
}

export default CustomerDashboard;
