export const PEOPLE = ['Jayant', 'Babita', 'Naveen'];
export const TEMPLATES = [
  {name:'Drink water',icon:'water',unit:'glasses',target:8,step:1,mode:'build',color:'blue'},
  {name:'Exercise',icon:'exercise',unit:'minutes',target:30,step:10,mode:'build',color:'green'},
  {name:'Read',icon:'read',unit:'pages',target:10,step:5,mode:'build',color:'purple'},
  {name:'Walk',icon:'walk',unit:'steps',target:6000,step:1000,mode:'build',color:'green'},
  {name:'Meditate',icon:'meditate',unit:'minutes',target:10,step:5,mode:'build',color:'purple'},
  {name:'Sleep',icon:'sleep',unit:'hours',target:8,step:0.5,mode:'build',color:'blue'},
  {name:'Alcohol',icon:'alcohol',unit:'drinks',target:0,step:1,mode:'limit',color:'amber'},
  {name:'Smoking',icon:'smoking',unit:'cigarettes',target:0,step:1,mode:'limit',color:'rose'},
  {name:'Mood',icon:'mood',unit:'rating',target:0,step:1,mode:'observe',color:'amber'}
];
export function initialState() {
  return { version:1, habits:PEOPLE.flatMap(owner=>TEMPLATES.slice(0,3).map((h,i)=>({...h,id:`${owner.toLowerCase()}-${i}`,owner,createdOn:today(),archived:false}))), entries:[] };
}
export function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function validDate(d) { return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d && d <= today(); }
export function validMonth(m) { return typeof m==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
export function total(entries,habitId,date) { return Math.round(entries.filter(e=>e.habitId===habitId && e.date===date && !e.deleted).reduce((n,e)=>n+e.quantity,0)*100)/100; }
export function achieved(habit,entries,date) {
  const logged=entries.some(e=>e.habitId===habit.id && e.date===date && !e.deleted);
  if (!logged || habit.mode==='observe') return false;
  const n=total(entries,habit.id,date);
  return habit.mode==='limit' ? n<=habit.target : n>=habit.target;
}
export function validateHabit(input) {
  if (!input || typeof input.name!=='string' || !input.name.trim() || input.name.trim().length>60) throw new Error('Use a habit name between 1 and 60 characters.');
  if(typeof input.unit!=='string' || !input.unit.trim() || input.unit.trim().length>24) throw new Error('Add a unit, up to 24 characters.');
  if(!['build','limit','observe'].includes(input.mode)) throw new Error('Choose a valid tracking goal.');
  if(!Number.isFinite(input.target) || input.target<0 || input.target>1000000 || (input.mode==='build' && input.target===0)) throw new Error('Use a positive build target, or a zero-or-greater limit.');
  if(!Number.isFinite(input.step) || input.step<=0 || input.step>1000000) throw new Error('Quick-log quantity must be greater than zero.');
  return {name:input.name.trim(),unit:input.unit.trim(),mode:input.mode,target:input.target,step:input.step,icon:TEMPLATES.some(t=>t.icon===input.icon)?input.icon:'custom',color:['green','blue','purple','amber','rose'].includes(input.color)?input.color:'green'};
}
