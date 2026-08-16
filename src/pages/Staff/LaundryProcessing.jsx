import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  getBookingsByStatus, 
  updateBookingStatus 
} from "../../services/bookingService";
import { 
  notifyWashingStarted,
  notifyDryingStarted,
  notifyFoldingStarted,
  notifyReadyForPickup
} from "../../services/notificationService";
import "../../styles/LaundryProcessing.css";

function LaundryProcessing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookingsByStage, setBookingsByStage] = useState({
    washing: [],
    drying: [],
    folding: [],
    readyForPickup: [],
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [draggedBooking, setDraggedBooking] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const stages = [
          { status: "Washing", key: "washing" },
          { status: "Drying", key: "drying" },
          { status: "Folding", key: "folding" },
          { status: "Ready for Customer Pickup", key: "readyForPickup" },
        ];

        const stages_data = {};

        for (const stage of stages) {
          const bookings = await getBookingsByStatus(stage.status);
          stages_data[stage.key] = bookings;
        }

        setBookingsByStage(stages_data);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const handleMoveToNextStage = async (booking, fromStage) => {
    const stageFlow = {
      washing: { next: "Drying", nextStage: "drying", notification: notifyDryingStarted },
      drying: { next: "Folding", nextStage: "folding", notification: notifyFoldingStarted },
      folding: { next: "Ready for Customer Pickup", nextStage: "readyForPickup", notification: notifyReadyForPickup },
      readyForPickup: { next: "Completed", nextStage: "completed", notification: null },
    };

    const stageInfo = stageFlow[fromStage];
    if (!stageInfo) return;

    if (!confirm(`Move booking #${booking.booking_id?.slice(-4) || booking.id?.slice(-4)} to ${stageInfo.next}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await updateBookingStatus(booking.id, stageInfo.next);

      // Send notification to customer
      if (booking.customer_id && stageInfo.notification) {
        await stageInfo.notification(booking.customer_id, booking.booking_id || booking.id);
      }

      // Update UI
      const updatedBookings = { ...bookingsByStage };
      updatedBookings[fromStage] = updatedBookings[fromStage].filter(b => b.id !== booking.id);

      if (stageInfo.nextStage !== "completed") {
        updatedBookings[stageInfo.nextStage] = [
          ...updatedBookings[stageInfo.nextStage],
          { ...booking, status: stageInfo.next }
        ];
      }

      setBookingsByStage(updatedBookings);
      alert(`Booking moved to ${stageInfo.next}!`);
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Error updating booking status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDragStart = (e, booking, stage) => {
    setDraggedBooking({ booking, stage });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, toStage) => {
    e.preventDefault();
    if (!draggedBooking) return;

    const { booking, stage: fromStage } = draggedBooking;
    if (fromStage !== toStage) {
      await handleMoveToNextStage(booking, fromStage);
    }
    setDraggedBooking(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const StageColumn = ({ title, stage, bookings, nextStageLabel }) => (
    <div
      className="stage-column"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, stage)}
    >
      <div className="stage-header">
        <h3>{title}</h3>
        <span className="booking-count">{bookings.length}</span>
      </div>

      <div className="bookings-list">
        {bookings.length > 0 ? (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="booking-item"
              draggable
              onDragStart={(e) => handleDragStart(e, booking, stage)}
            >
              <div className="booking-card-mini">
                <p className="booking-id">
                  #{booking.booking_id?.slice(-4) || booking.id?.slice(-4)}
                </p>
                <p className="customer-name">
                  {booking.customer?.name || "Unknown"}
                </p>
                <p className="booking-weight">
                  {booking.weight} kg
                </p>
                <p className="booking-date">
                  {formatDate(booking.booking_date)}
                </p>
                <button
                  className="btn btn-small btn-primary"
                  onClick={() => handleMoveToNextStage(booking, stage)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : `→ ${nextStageLabel}`}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-stage">
            <p>No bookings</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="laundry-processing-page">
      <div className="page-header">
        <h1>Laundry Processing</h1>
        <p>Track and manage laundry through each stage of processing (drag and drop or use buttons)</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading laundry stages...</div>
      ) : (
        <div className="processing-board">
          <StageColumn
            title="🌊 Washing"
            stage="washing"
            bookings={bookingsByStage.washing}
            nextStageLabel="Drying"
          />
          <StageColumn
            title="🌬️ Drying"
            stage="drying"
            bookings={bookingsByStage.drying}
            nextStageLabel="Folding"
          />
          <StageColumn
            title="📦 Folding"
            stage="folding"
            bookings={bookingsByStage.folding}
            nextStageLabel="Ready"
          />
          <StageColumn
            title="✅ Ready for Pickup"
            stage="readyForPickup"
            bookings={bookingsByStage.readyForPickup}
            nextStageLabel="Complete"
          />
        </div>
      )}
    </div>
  );
}

export default LaundryProcessing;
