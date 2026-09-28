import type { Education } from "./types";

// Shown while the education migration has not yet been applied.
export const DEFAULT_EDUCATION: Education[] = [
  { id: "school-2010", degree: "小学", school: "厦门市同安区第一实验小学", date: "2010-09-01", location: "厦门市", city_name: "厦门市", latitude: 24.72, longitude: 118.15 },
  { id: "school-2016", degree: "初中", school: "厦门市东山中学", date: "2016-09-01", location: "厦门市", city_name: "厦门市", latitude: 24.72, longitude: 118.15 },
  { id: "school-2019", degree: "高中", school: "厦门外国语学校", date: "2019-09-01", location: "厦门市", city_name: "厦门市", latitude: 24.48, longitude: 118.09 },
  { id: "school-2022", degree: "本科", school: "福州大学", date: "2022-09-01", location: "福州市", city_name: "福州市", latitude: 26.06, longitude: 119.2 },
  { id: "school-2026", degree: "硕士研究生", school: "南洋理工大学", date: "2026-08-01", location: "新加坡", city_name: null, latitude: 1.3483, longitude: 103.6831 },
];

export function validateEducation(body: Record<string, unknown>) {
  const degree = String(body.degree ?? "").trim();
  const school = String(body.school ?? "").trim();
  const date = String(body.date ?? "");
  const location = String(body.location ?? "").trim();
  const city_name = body.city_name === null ? null : String(body.city_name ?? "").trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!degree || !school || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !location ||
      (city_name !== null && !city_name) || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("请填写学历、学校、开始日期、地点及有效地图位置");
  }
  return { degree, school, date, location, city_name, latitude, longitude };
}
