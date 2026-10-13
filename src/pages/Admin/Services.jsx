import { useEffect, useState } from "react";
import {
  addService,
  deleteService,
  ensureDefaultServices,
  subscribeToServices,
  updateService,
} from "../../services/laundryService";
import "../../styles/AdminServices.css";

function Services() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    icon: "🧺",
  });

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const loadServices = async () => {
      try {
        await ensureDefaultServices();

        if (!isMounted) return;

        unsubscribe = subscribeToServices(
          (nextServices) => {
            if (!isMounted) return;

            setServices(nextServices);
            setIsLoading(false);
          },
          (loadError) => {
            if (!isMounted) return;

            console.error("Error loading services:", loadError);
            setError("Unable to load services. Please refresh and try again.");
            setIsLoading(false);
          }
        );
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Error initializing services:", loadError);
        setError("Unable to load services. Please refresh and try again.");
        setIsLoading(false);
      }
    };

    loadServices();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // =====================================
  // OPEN ADD MODAL
  // =====================================

  const handleAdd = () => {
    setEditingService(null);

    setFormData({
      name: "",
      description: "",
      price: "",
      icon: "🧺",
    });

    setShowModal(true);
  };

  // =====================================
  // OPEN EDIT MODAL
  // =====================================

  const handleEdit = (service) => {
    setEditingService(service);

    setFormData({
      name: service.name,
      description: service.description,
      price: service.price,
      icon: service.icon,
    });

    setShowModal(true);
  };

  // =====================================
  // FORM CHANGE
  // =====================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================
  // SAVE SERVICE
  // =====================================

  const handleSave = async (e) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.description.trim() ||
      !formData.price
    ) {
      alert("Please complete all required fields.");
      return;
    }

    const price = Number(formData.price);

    if (!Number.isFinite(price) || price < 0) {
      alert("Please enter a valid service price.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description,
        price,
        icon: formData.icon,
      };

      if (editingService) {
        await updateService(editingService.id, serviceData);
      } else {
        await addService({ ...serviceData, status: "Active" });
      }

      setShowModal(false);
    } catch (saveError) {
      console.error("Error saving service:", saveError);
      setError("Unable to save this service. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // =====================================
  // DELETE SERVICE
  // =====================================

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this service?"
    );

    if (!confirmDelete) return;

    setError("");

    try {
      await deleteService(id);
    } catch (deleteError) {
      console.error("Error deleting service:", deleteError);
      setError("Unable to delete this service. Please try again.");
    }
  };

  // =====================================
  // TOGGLE STATUS
  // =====================================

  const toggleStatus = async (service) => {
    setError("");

    try {
      await updateService(service.id, {
        status: service.status === "Active" ? "Inactive" : "Active",
      });
    } catch (updateError) {
      console.error("Error updating service status:", updateError);
      setError("Unable to update this service. Please try again.");
    }
  };

  // =====================================
  // SEARCH
  // =====================================

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(search.toLowerCase())
  );

  // =====================================
  // SUMMARY
  // =====================================

  const activeServices = services.filter(
    (service) => service.status === "Active"
  ).length;

  return (
    <div className="admin-services">

      {/* =====================================
          PAGE HEADER
      ===================================== */}

      <div className="services-header">
        <div>
          <span className="page-label">LAUNDRYMATE ADMIN</span>

          <h1>Services</h1>

          <p>
            Manage the laundry services available to your customers.
          </p>
        </div>

        {error && (
          <div className="service-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="add-service-btn"
          onClick={handleAdd}
        >
          <span>＋</span>
          Add Service
        </button>
      </div>

      {/* =====================================
          SUMMARY CARDS
      ===================================== */}

      <div className="service-stats">

        <div className="service-stat-card">
          <div className="stat-icon blue">🧺</div>

          <div>
            <span>Total Services</span>
            <strong>{services.length}</strong>
          </div>
        </div>

        <div className="service-stat-card">
          <div className="stat-icon green">✓</div>

          <div>
            <span>Active Services</span>
            <strong>{activeServices}</strong>
          </div>
        </div>

        <div className="service-stat-card">
          <div className="stat-icon gray">○</div>

          <div>
            <span>Inactive Services</span>
            <strong>
              {services.length - activeServices}
            </strong>
          </div>
        </div>

      </div>

      {/* =====================================
          SERVICES CONTAINER
      ===================================== */}

      <div className="services-container">

        <div className="services-toolbar">

          <div>
            <h2>Available Services</h2>
            <p>
              View and manage all laundry services.
            </p>
          </div>

          <div className="service-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

        </div>

        {/* =====================================
            SERVICE LIST
        ===================================== */}

        <div className="service-list">

          {isLoading ? (
            <div className="empty-services">
              <h3>Loading services...</h3>
            </div>
          ) : filteredServices.length > 0 ? (
            filteredServices.map((service) => (

              <div
                className="service-row"
                key={service.id}
              >

                <div className="service-main">

                  <div className="service-icon">
                    {service.icon}
                  </div>

                  <div className="service-info">

                    <h3>{service.name}</h3>

                    <p>{service.description}</p>

                  </div>

                </div>

                <div className="service-price">
                  <span>Price / kg</span>
                  <strong>
                    ₱{service.price.toLocaleString()}
                  </strong>
                </div>

                <div className="service-status">

                  <button
                    className={`status-badge ${
                      service.status.toLowerCase()
                    }`}
                    onClick={() => toggleStatus(service)}
                  >
                    <span></span>
                    {service.status}
                  </button>

                </div>

                <div className="service-actions">

                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(service)}
                    title="Edit service"
                  >
                    ✎
                  </button>

                  <button
                    className="delete-btn"
                    onClick={() =>
                      handleDelete(service.id)
                    }
                    title="Delete service"
                  >
                    🗑
                  </button>

                </div>

              </div>

            ))
          ) : (

            <div className="empty-services">

              <div className="empty-icon">
                🔍
              </div>

              <h3>No services found</h3>

              <p>
                Try searching for another service.
              </p>

            </div>

          )}

        </div>

      </div>

      {/* =====================================
          ADD / EDIT MODAL
      ===================================== */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >

          <div
            className="service-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">

              <div>
                <span className="modal-label">
                  SERVICE MANAGEMENT
                </span>

                <h2>
                  {editingService
                    ? "Edit Service"
                    : "Add New Service"}
                </h2>

                <p>
                  {editingService
                    ? "Update the service information."
                    : "Create a new laundry service."}
                </p>
              </div>

              <button
                className="close-modal"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleSave}>

              {/* ICON */}

              <div className="form-group">

                <label>Service Icon</label>

                <div className="icon-options">

                  {["🧺", "👔", "👕", "🛏️", "🧼", "✨"].map(
                    (icon) => (

                      <button
                        type="button"
                        key={icon}
                        className={
                          formData.icon === icon
                            ? "selected-icon"
                            : ""
                        }
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            icon,
                          }))
                        }
                      >
                        {icon}
                      </button>

                    )
                  )}

                </div>

              </div>

              {/* NAME */}

              <div className="form-group">

                <label>
                  Service Name <span>*</span>
                </label>

                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Wash & Fold"
                  value={formData.name}
                  onChange={handleChange}
                />

              </div>

              {/* DESCRIPTION */}

              <div className="form-group">

                <label>
                  Description <span>*</span>
                </label>

                <textarea
                  name="description"
                  placeholder="Describe this laundry service..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                />

              </div>

              {/* PRICE */}

              <div className="form-group">

                <label>
                  Price per Kilogram <span>*</span>
                </label>

                <div className="price-input">

                  <span>₱</span>

                  <input
                    type="number"
                    name="price"
                    min="0"
                    placeholder="80"
                    value={formData.price}
                    onChange={handleChange}
                  />

                  <small>/ kg</small>

                </div>

              </div>

              {/* BUTTONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingService
                    ? "Save Changes"
                    : "Add Service"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default Services;