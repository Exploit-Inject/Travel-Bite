"use client";
import { useState, type FormEvent } from "react";
import { MapPin, ArrowRight, Navigation } from "lucide-react";
import { useApp } from "./app-provider";
import { Dialog } from "./dialog";
import type { Journey } from "@/lib/types";
function localDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function JourneyForm({ onClose }: { onClose: () => void }) {
  const { catalog, journey, setJourney, toast } = useApp();
  const first = catalog.routes[0];
  const [form, setForm] = useState<Journey>(
    journey || {
      routeId: first?._id || "",
      busNumber: "",
      seatNumber: "",
      currentLocation: "",
      stopId: first?.stops[0]?.id || "",
      arrivalAt: new Date(
        Date.now() + (first?.stops[0]?.minutes || 60) * 60000,
      ).toISOString(),
    },
  );
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const route = catalog.routes.find((r) => r._id === form.routeId);
  const update = (key: keyof Journey, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!route?.stops.some((s) => s.id === form.stopId)) {
      setError("Choose a delivery stop on your route.");
      return;
    }
    if (new Date(form.arrivalAt).getTime() < Date.now() + 20 * 60000) {
      setError("Choose an arrival at least 20 minutes from now.");
      return;
    }
    setJourney(form);
    onClose();
    toast("Journey saved. Your next stop is looking delicious.");
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <p className="muted">
        Tell us where you’re headed. We’ll show food available at your stop.
      </p>
      <label>
        Bus route
        <select
          value={form.routeId}
          onChange={(e) => {
            const r = catalog.routes.find((r) => r._id === e.target.value)!;
            setForm((old) => ({
              ...old,
              routeId: r._id,
              stopId: r.stops[0].id,
              arrivalAt: new Date(
                Date.now() + r.stops[0].minutes * 60000,
              ).toISOString(),
            }));
          }}
          required
        >
          {catalog.routes.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          Bus number
          <input
            placeholder="e.g. DL 01 AB 1234"
            value={form.busNumber}
            onChange={(e) => update("busNumber", e.target.value.toUpperCase())}
            minLength={4}
            maxLength={24}
            required
          />
        </label>
        <label>
          Seat number
          <input
            placeholder="e.g. 12A"
            value={form.seatNumber}
            onChange={(e) => update("seatNumber", e.target.value.toUpperCase())}
            maxLength={12}
            required
          />
        </label>
      </div>
      <div>
        <label htmlFor="current-location">Current location</label>
        <div className="location-input">
          <input
            id="current-location"
            placeholder="City, landmark or coordinates"
            value={form.currentLocation}
            onChange={(e) => update("currentLocation", e.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
          <button
            type="button"
            aria-label="Use current location"
            disabled={locating}
            onClick={() => {
              if (!navigator.geolocation) {
                setError("Location is unavailable. Enter your location above.");
                return;
              }
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  update(
                    "currentLocation",
                    `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`,
                  );
                  setLocating(false);
                },
                () => {
                  setError(
                    "Couldn't access your location. You can type it instead.",
                  );
                  setLocating(false);
                },
                { timeout: 12000 },
              );
            }}
          >
            <Navigation size={18} />
          </button>
        </div>
      </div>
      <label>
        Deliver at
        <MapPin className="field-icon" size={16} />
        <select
          value={form.stopId}
          onChange={(e) => {
            const stop = route?.stops.find((s) => s.id === e.target.value);
            setForm((old) => ({
              ...old,
              stopId: e.target.value,
              arrivalAt: new Date(
                Date.now() + (stop?.minutes || 60) * 60000,
              ).toISOString(),
            }));
          }}
          required
        >
          {route?.stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Expected arrival at your stop
        <input
          type="datetime-local"
          value={localDate(form.arrivalAt)}
          onChange={(e) => {
            if (e.target.value)
              update("arrivalAt", new Date(e.target.value).toISOString());
          }}
          required
        />
      </label>
      <p className="small muted">
        Confirm arrival with your bus operator. Times are your estimate; Travel
        Bite does not track the bus live.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={!catalog.routes.length}>
        Find food on my route
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
export function JourneyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Your journey, your meal">
      <JourneyForm onClose={onClose} />
    </Dialog>
  );
}
