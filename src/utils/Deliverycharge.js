export const calculateDeliveryCharge = (distanceKm) => {
  const km = parseFloat(distanceKm);
  if (isNaN(km) || km < 0) return 30;
  if (km <= 3) return 30;
  if (km <= 7) return Math.round(30 + (km - 3) * 10);
  return Math.round(30 + 4 * 10 + (km - 7) * 15);
}
 
export default calculateDeliveryCharge;
 

