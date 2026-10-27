// Reference data for delivery: Phnom Penh's districts (khan) and the
// provinces. Place names are data, like a lookup table — not UI text — so
// they live here with both languages rather than in messages/*.json.

export interface Place {
  id: string;
  nameKm: string;
  nameEn: string;
}

/** The 14 khans of Phnom Penh, roughly centre outwards. */
export const PHNOM_PENH_DISTRICTS: readonly Place[] = [
  { id: "daun-penh", nameKm: "ដូនពេញ", nameEn: "Daun Penh" },
  { id: "chamkar-mon", nameKm: "ចំការមន", nameEn: "Chamkar Mon" },
  { id: "prampir-makara", nameKm: "៧មករា", nameEn: "Prampir Makara" },
  { id: "boeng-keng-kang", nameKm: "បឹងកេងកង", nameEn: "Boeng Keng Kang" },
  { id: "tuol-kouk", nameKm: "ទួលគោក", nameEn: "Tuol Kouk" },
  { id: "sen-sok", nameKm: "សែនសុខ", nameEn: "Sen Sok" },
  { id: "russey-keo", nameKm: "ឫស្សីកែវ", nameEn: "Russey Keo" },
  { id: "chroy-changvar", nameKm: "ជ្រោយចង្វារ", nameEn: "Chroy Changvar" },
  { id: "mean-chey", nameKm: "មានជ័យ", nameEn: "Mean Chey" },
  { id: "chbar-ampov", nameKm: "ច្បារអំពៅ", nameEn: "Chbar Ampov" },
  { id: "pou-senchey", nameKm: "ពោធិ៍សែនជ័យ", nameEn: "Pou Senchey" },
  { id: "dangkao", nameKm: "ដង្កោ", nameEn: "Dangkao" },
  { id: "prek-pnov", nameKm: "ព្រែកព្នៅ", nameEn: "Prek Pnov" },
  { id: "kamboul", nameKm: "កំបូល", nameEn: "Kamboul" },
];

/** The 24 provinces outside Phnom Penh, A–Z in English. */
export const PROVINCES: readonly Place[] = [
  { id: "banteay-meanchey", nameKm: "បន្ទាយមានជ័យ", nameEn: "Banteay Meanchey" },
  { id: "battambang", nameKm: "បាត់ដំបង", nameEn: "Battambang" },
  { id: "kampong-cham", nameKm: "កំពង់ចាម", nameEn: "Kampong Cham" },
  { id: "kampong-chhnang", nameKm: "កំពង់ឆ្នាំង", nameEn: "Kampong Chhnang" },
  { id: "kampong-speu", nameKm: "កំពង់ស្ពឺ", nameEn: "Kampong Speu" },
  { id: "kampong-thom", nameKm: "កំពង់ធំ", nameEn: "Kampong Thom" },
  { id: "kampot", nameKm: "កំពត", nameEn: "Kampot" },
  { id: "kandal", nameKm: "កណ្តាល", nameEn: "Kandal" },
  { id: "kep", nameKm: "កែប", nameEn: "Kep" },
  { id: "koh-kong", nameKm: "កោះកុង", nameEn: "Koh Kong" },
  { id: "kratie", nameKm: "ក្រចេះ", nameEn: "Kratie" },
  { id: "mondulkiri", nameKm: "មណ្ឌលគិរី", nameEn: "Mondulkiri" },
  { id: "oddar-meanchey", nameKm: "ឧត្តរមានជ័យ", nameEn: "Oddar Meanchey" },
  { id: "pailin", nameKm: "ប៉ៃលិន", nameEn: "Pailin" },
  { id: "preah-sihanouk", nameKm: "ព្រះសីហនុ", nameEn: "Preah Sihanouk" },
  { id: "preah-vihear", nameKm: "ព្រះវិហារ", nameEn: "Preah Vihear" },
  { id: "prey-veng", nameKm: "ព្រៃវែង", nameEn: "Prey Veng" },
  { id: "pursat", nameKm: "ពោធិ៍សាត់", nameEn: "Pursat" },
  { id: "ratanakiri", nameKm: "រតនគិរី", nameEn: "Ratanakiri" },
  { id: "siem-reap", nameKm: "សៀមរាប", nameEn: "Siem Reap" },
  { id: "stung-treng", nameKm: "ស្ទឹងត្រែង", nameEn: "Stung Treng" },
  { id: "svay-rieng", nameKm: "ស្វាយរៀង", nameEn: "Svay Rieng" },
  { id: "takeo", nameKm: "តាកែវ", nameEn: "Takeo" },
  { id: "tboung-khmum", nameKm: "ត្បូងឃ្មុំ", nameEn: "Tboung Khmum" },
];

const DISTRICT_IDS = new Set(PHNOM_PENH_DISTRICTS.map((place) => place.id));
const PROVINCE_IDS = new Set(PROVINCES.map((place) => place.id));

export function isPhnomPenhDistrict(id: string): boolean {
  return DISTRICT_IDS.has(id);
}

export function isProvince(id: string): boolean {
  return PROVINCE_IDS.has(id);
}

export function placeName(place: Place, locale: string): string {
  return locale === "km" ? place.nameKm : place.nameEn;
}

const MAP_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

/** A shop's address as a map search buyers can open (Google Maps opens the app on a phone). */
export function mapSearchUrl(address: string): string | null {
  const query = address.trim();
  return query ? `${MAP_SEARCH_URL}${encodeURIComponent(query)}` : null;
}

/** Where the buyer's Map button goes: the seller's own map link, else a search for the address. */
export function shopMapLink(mapUrl: string, address: string): string | null {
  return mapUrl.trim() || mapSearchUrl(address);
}
