const CHART_ID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CHART_ID_LENGTH = 6;

export function generateChartId(): string {
  let result = "";
  for (let i = 0; i < CHART_ID_LENGTH; i++) {
    result += CHART_ID_CHARS.charAt(Math.floor(Math.random() * CHART_ID_CHARS.length));
  }
  return result;
}
