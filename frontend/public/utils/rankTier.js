export function getPremierRankLabel(rank) {
  const rating = parseInt(rank);

  if (isNaN(rating)) {
    return {
      tier: "Unknown",
      color: "bg-gray-700 text-white border-white",
    };
  }

  if (rating < 5000)
    return { tier: rating, color: "bg-gray-700 text-white border-white" };
  if (rating < 10000)
    return { tier: rating, color: "bg-blue-500 text-white border-blue-300" };
  if (rating < 15000)
    return { tier: rating, color: "bg-indigo-600 text-white border-indigo-300" };
  if (rating < 20000)
    return { tier: rating, color: "bg-purple-600 text-white border-purple-300" };
  if (rating < 25000)
    return { tier: rating, color: "bg-fuchsia-600 text-white border-fuchsia-300" };
  if (rating < 30000)
    return { tier: rating, color: "bg-red-600 text-white border-red-300" };

  return { tier: rating, color: "bg-yellow-500 text-black border-yellow-300" };
}
