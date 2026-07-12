export type MakerCard = { id:string; name:string; imageUrl:string|null; civilization:string[]; cost:number|null; cardType:string|null }
export type MakerGroup = { key:string; label:string; color:string }
export const TIER_GROUPS: MakerGroup[] = [
  {key:'s',label:'S',color:'border-red-300 bg-red-50 text-red-800'}, {key:'a',label:'A',color:'border-orange-300 bg-orange-50 text-orange-800'},
  {key:'b',label:'B',color:'border-amber-300 bg-amber-50 text-amber-800'}, {key:'c',label:'C',color:'border-emerald-300 bg-emerald-50 text-emerald-800'},
  {key:'d',label:'D',color:'border-sky-300 bg-sky-50 text-sky-800'},
]
export type MakerDraft = Record<string,string[]>
export function emptyMakerDraft(groups:MakerGroup[]):MakerDraft { return Object.fromEntries(groups.map(g=>[g.key,[]])) }
