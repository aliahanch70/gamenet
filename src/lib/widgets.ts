export type WidgetType = 'stats'|'leaderboard'|'promo'|'faq'|'announcement'|'testimonials'
export type Widget = { id:string; type:WidgetType; enabled:boolean; title:string; props:any }
export const WIDGET_CATALOG: Record<WidgetType,{label:string;icon:string;desc:string;defaults:any}> = {
  stats: { label:'آمار زنده', icon:'📊', desc:'سه عدد کلیدی مثل سیستم/کاربر/جایزه', defaults:{ items:[{label:'کاربر فعال',value:'۳۴۰'},{label:'مسابقه امروز',value:'۱۲'},{label:'جایزه ماه',value:'۵۰M'}] } },
  leaderboard: { label:'تابلوی برترین‌ها', icon:'🏆', desc:'۳ نفر برتر بر اساس موجودی', defaults:{} },
  promo: { label:'بنر دعوت', icon:'🎁', desc:'پیشنهاد ویژه با دکمه', defaults:{ text:'این هفته ۲۰٪ شارژ هدیه — فقط تا جمعه', cta:'شارژ کن', link:'/wallet' } },
  faq: { label:'سوالات متداول', icon:'❓', desc:'پرسش و پاسخ قابل ویرایش', defaults:{ items:[{q:'چطور شرط ببندم؟',a:'وارد بخش شرط‌بندی شو، مسابقه را انتخاب کن و مبلغ را تایید کن.'},{q:'تسویه چقدر طول می‌کشد؟',a:'بلافاصله پس از اعلام برنده، خودکار واریز می‌شود.'}] } },
  announcement: { label:'نوار اطلاعیه', icon:'📢', desc:'پیام باریک بالای صفحه', defaults:{ text:'🎉 تورنمنت جمعه — جایزه ۱۰ میلیون تومان' } },
  testimonials: { label:'نظرات کاربران', icon:'💬', desc:'۳ نظر نمونه', defaults:{ items:[{name:'علی',text:'بهترین گیم‌نت تهران، سیستم‌ها عالیه'},{name:'سارا',text:'شرط‌بندی امن و تسویه سریع'},{name:'رضا',text:'پرسنل حرفه‌ای و محیط تمیز'}] } },
}
export const newId = ()=> Math.random().toString(36).slice(2,8)
