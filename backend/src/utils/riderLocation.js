// What a teacher may see of a rider. A position is only given out while the rider is sharing it;
// a rider who stopped sharing (or never started) shows no place and no time.
function publicRiderLocation(r) {
  const live = Boolean(r.active) && r.latitude != null && r.longitude != null;
  return {
    riderId: r.riderId,
    name: r.name,
    external_id: r.external_id,
    latitude: live ? Number(r.latitude) : null,
    longitude: live ? Number(r.longitude) : null,
    accuracy_m: live && r.accuracy_m != null ? Number(r.accuracy_m) : null,
    active: live,
    updated_at: live ? r.updated_at : null,
  };
}

module.exports = { publicRiderLocation };
