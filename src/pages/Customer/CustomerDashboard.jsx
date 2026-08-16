import React from "react";
import "../../styles/CustomerDashboard.css";

const stats = [
  {
    label: "Active orders",
    value: "04",
    change: "+2 this week",
    tone: "blue",
  },
  {
    label: "Laundry spent",
    value: "₱186",
    change: "Last 30 days",
    tone: "green",
  },
  {
    label: "Membership",
    value: "Gold",
    change: "VIP perks active",
    tone: "purple",
  },
  {
    label: "Next pickup",
    value: "Today",
    change: "3:30 PM",
    tone: "orange",
  },
];

const recentOrders = [
  {
    name: "Premium Wash & Fold",
    status: "In progress",
    timing: "Pickup 3:30 PM",
  },
  {
    name: "Bedding Refresh",
    status: "Ready for pickup",
    timing: "Pickup tomorrow",
  },
  {
    name: "Dry Cleaning",
    status: "Scheduled",
    timing: "Pickup Friday",
  },
];

const services = [
  {
    title: "Wash & Fold",
    description: "Fast, hygienic, and neatly packed.",
  },
  {
    title: "Dry Cleaning",
    description: "Delicate garments handled with care.",
  },
  {
    title: "Ironing",
    description: "Crisp finish for work essentials.",
  },
  {
    title: "Bedding Care",
    description: "Deep clean for comfort and freshness.",
  },
];

function CustomerDashboard() {
  return (
    <div className="customer-dashboard">

      {/* Dashboard Hero */}
      <section className="dashboard-hero">
        <div className="hero-content">

          <div className="welcome-icon">
            👋
          </div>

          <div>
            <p className="eyebrow">CUSTOMER DASHBOARD</p>

            <h1>Welcome back!</h1>

            <p className="hero-description">
              Keep your laundry fresh, organized, and effortless.
            </p>
          </div>

        </div>

        <button className="primary-btn">
          <span>＋</span>
          Book a service
        </button>
      </section>


      {/* Statistics */}
      <section className="stats-grid">

        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`stat-card ${stat.tone}`}
          >

            <div className="stat-top">

              <span className="stat-label">
                {stat.label}
              </span>

              <div className="stat-icon">

                {stat.tone === "blue" && "🧺"}
                {stat.tone === "green" && "₱"}
                {stat.tone === "purple" && "★"}
                {stat.tone === "orange" && "⏱"}

              </div>

            </div>

            <strong className="stat-value">
              {stat.value}
            </strong>

            <span className="stat-change">
              {stat.change}
            </span>

          </div>
        ))}

      </section>


      {/* Main Dashboard */}
      <section className="dashboard-grid">

        {/* Recent Orders */}
        <div className="panel panel-large">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                ORDERS
              </p>

              <h3>
                Recent orders
              </h3>
            </div>

            <button className="text-btn">
              View all →
            </button>

          </div>


          <div className="orders-list">

            {recentOrders.map((order, index) => {

              let statusClass = "";

              if (order.status === "In progress") {
                statusClass = "in-progress";
              } else if (order.status === "Ready for pickup") {
                statusClass = "ready-for-pickup";
              } else if (order.status === "Scheduled") {
                statusClass = "scheduled";
              }

              return (
                <div
                  key={order.name}
                  className="order-item"
                >

                  <div className="order-number">
                    0{index + 1}
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

                  <button
                    className="order-arrow"
                    type="button"
                  >
                    →
                  </button>

                </div>
              );
            })}

          </div>

        </div>


        {/* Quick Services */}
        <div className="panel panel-side">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                SERVICES
              </p>

              <h3>
                Quick services
              </h3>
            </div>

          </div>


          <div className="service-list">

            {services.map((service, index) => {

              let icon = "🧺";

              if (index === 1) {
                icon = "👔";
              }

              if (index === 2) {
                icon = "✨";
              }

              if (index === 3) {
                icon = "🛏️";
              }

              return (
                <div
                  key={service.title}
                  className="service-item"
                >

                  <div className="service-icon">
                    {icon}
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

                </div>
              );
            })}

          </div>

        </div>

      </section>


      {/* Bottom Grid */}
      <section className="bottom-grid">

        {/* Pickup Summary */}
        <div className="panel">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                PICKUP
              </p>

              <h3>
                Pickup summary
              </h3>
            </div>

            <span className="mini-tag">
              This week
            </span>

          </div>


          <div className="summary-box">

            <div className="summary-item">

              <div className="summary-icon completed">
                ✓
              </div>

              <div>
                <span className="summary-label">
                  Completed
                </span>

                <strong>
                  12 items
                </strong>
              </div>

            </div>


            <div className="summary-item">

              <div className="summary-icon remaining">
                ◷
              </div>

              <div>
                <span className="summary-label">
                  Remaining
                </span>

                <strong>
                  07 items
                </strong>
              </div>

            </div>

          </div>


          <div className="progress-container">

            <div className="progress-header">

              <span>
                Weekly progress
              </span>

              <strong>
                63%
              </strong>

            </div>

            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>

          </div>

        </div>


        {/* Customer Perks */}
        <div className="panel perks-panel">

          <div className="panel-header">

            <div>
              <p className="panel-eyebrow">
                MEMBERSHIP
              </p>

              <h3>
                Customer perks
              </h3>
            </div>

            <span className="gold-badge">
              ★ GOLD
            </span>

          </div>


          <ul className="perk-list">

            <li>
              <span className="perk-check">
                ✓
              </span>

              <span>
                Free pickup on orders above ₱2,000
              </span>
            </li>

            <li>
              <span className="perk-check">
                ✓
              </span>

              <span>
                10% discount on your next subscription
              </span>
            </li>

            <li>
              <span className="perk-check">
                ✓
              </span>

              <span>
                Priority scheduling for premium cleaning
              </span>
            </li>

          </ul>


          <button
            className="secondary-btn"
            type="button"
          >
            View membership benefits →
          </button>

        </div>

      </section>

    </div>
  );
}

export default CustomerDashboard;