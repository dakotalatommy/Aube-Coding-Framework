export default function Pricing(){
  const plan = { name:'Founder', price:'$147', blurb:'/mo', cta:'Join our waitlist!', features:[
    'Consent‑first messaging (7d/3d/1d/2h)',
    'Smart cadences + approvals',
    'Acuity/Square/HubSpot + Google/Apple calendar',
    'AskVX guidance + tours',
    'Referral discounts: 1 → $127, 2 → $97/mo'
  ] };
  return (
    <section className="grid md:grid-cols-1 gap-4">
      <div className="rounded-2xl bg-white border shadow-sm p-5">
        <div className="flex items-baseline gap-2">
          <h3 className="text-slate-900 font-semibold">{plan.name}</h3>
          <div className="text-slate-500 text-sm">{plan.blurb}</div>
        </div>
        <div className="mt-1 text-3xl font-bold text-slate-900">{plan.price}</div>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {plan.features.map((f)=> (<li key={f} className="flex gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pink-500 mt-2"/> {f}</li>))}
        </ul>
        <button className="mt-4 px-4 py-2 rounded-xl text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">{plan.cta}</button>
      </div>
    </section>
  );
}


