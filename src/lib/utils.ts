// 클래스명 조합 유틸 (조건부 className 합치기)
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
