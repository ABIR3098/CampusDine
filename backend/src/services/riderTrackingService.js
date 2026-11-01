// CampusDine Service: Campus GPS Rider Tracking & Delivery Path Interpolation
const CAMPUS_WAYPOINTS = {
  canteen: { name: "Central Cafeteria", lat: 23.8382, lng: 90.3582 },
  library: { name: "Central Library", lat: 23.8395, lng: 90.3590 },
  academic_fbs: { name: "Faculty Building (FBS)", lat: 23.8405, lng: 90.3602 },
  hall_boys: { name: "Muktijoddha Hall (Boys)", lat: 23.8420, lng: 90.3620 },
  hall_girls: { name: "Tarangini Hall (Girls)", lat: 23.8415, lng: 90.3635 }
};

const RiderTrackingService = {
  CAMPUS_WAYPOINTS,

  // Haversine formula to compute distance in meters between two coordinates
  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  },

  // Calculate estimated time of arrival based on standard bicycle speed (12 km/h ~ 3.33 m/s)
  calculateETA(distanceMeters) {
    const speedMps = 3.33;
    const prepBufferSeconds = 120; // 2 min buffer
    const travelSeconds = Math.round(distanceMeters / speedMps) + prepBufferSeconds;
    const minutes = Math.max(1, Math.ceil(travelSeconds / 60));
    return {
      distanceMeters,
      distanceKm: (distanceMeters / 1000).toFixed(2),
      estimatedMinutes: minutes,
      text: minutes + " mins"
    };
  },

  // Interpolate rider intermediate GPS position based on progress percentage (0 to 100%)
  interpolatePosition(startKey = "canteen", destKey = "hall_boys", progressPct = 0) {
    const start = CAMPUS_WAYPOINTS[startKey] || CAMPUS_WAYPOINTS.canteen;
    const dest = CAMPUS_WAYPOINTS[destKey] || CAMPUS_WAYPOINTS.hall_boys;
    const ratio = Math.min(1, Math.max(0, progressPct / 100));

    const currentLat = start.lat + (dest.lat - start.lat) * ratio;
    const currentLng = start.lng + (dest.lng - start.lng) * ratio;
    const totalDist = RiderTrackingService.calculateDistanceMeters(start.lat, start.lng, dest.lat, dest.lng);
    const remainingDist = Math.round(totalDist * (1 - ratio));

    return {
      currentLat: Number(currentLat.toFixed(6)),
      currentLng: Number(currentLng.toFixed(6)),
      progress: progressPct,
      remainingMeters: remainingDist,
      eta: RiderTrackingService.calculateETA(remainingDist)
    };
  }
};

module.exports = RiderTrackingService;
