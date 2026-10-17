// Publiczny odczyt przez proxy Netlify; bez dostępu administracyjnego.
const sections = [...document.querySelectorAll('main section')];
const status = document.querySelector('.demo');
const money = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pl-PL', {maximumFractionDigits: 2}) + ' zł' : '—';
let deadline = Date.now(), lastSuccess = null;
function renderRows(index, entries, delivery = false) {
  const body = sections[index].querySelector('tbody');
  body.replaceChildren();
  entries.forEach(item => {
    const tr = document.createElement('tr'), label = document.createElement('th');
    label.textContent = (item.displayNumber ? item.displayNumber + '. ' : '') + item.name;
    tr.append(label);
    [item.price, null, ...(delivery ? [null] : [])].forEach(price => {
      const td = document.createElement('td'); td.textContent = money(price); tr.append(td);
    });
    body.append(tr);
  });
}
async function refresh() {
  try {
    const res = await fetch('/panel-api/prices', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
    if (!res.ok) throw Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.products || !data.metals?.gold || !data.metals?.silver || !Number.isFinite(Date.parse(data.fetchedAt))) throw Error('Nieprawidłowe dane');
    if (Date.now() - Date.parse(data.fetchedAt) > 600000 || /zapasowe/i.test(data.provider || '')) throw Error('Nieaktualne lub zapasowe notowania');
    const gold = (data.products.goldCoins || []).filter(p => p.active !== false);
    // Kategorie nie są jeszcze zdefiniowane w panelu. Nie zgadujemy ich na podstawie nazwy.
    renderRows(0, gold.filter(p => p.category === 'bullion' || (!p.category && Number.isFinite(p.familyIndex))), true);
    renderRows(1, gold.filter(p => p.category === 'historical'));
    renderRows(2, gold.filter(p => p.category === 'other'));
    renderRows(3, (data.products.goldBars || []).filter(p => p.active !== false), true);
    renderRows(4, Object.entries(data.metals.gold.purities).map(([name, value]) => ({name: 'Próba ' + name, price: value.price})));
    renderRows(5, (data.products.silverCoins || []).filter(p => p.active !== false));
    renderRows(6, (data.products.silverBars || []).filter(p => p.active !== false));
    ['gold', 'silver'].forEach((metal, index) => {
      const item = data.metals[metal], target = document.querySelectorAll('.rate')[index];
      target.replaceChildren();
      target.append((index ? 'Srebro' : 'Złoto') + ' ' + (item.change > 0 ? '↑' : item.change < 0 ? '↓' : '↔') + ' ' + money(item.spot) + '/g');
    });
    lastSuccess = data.fetchedAt;
    status.textContent = 'PODGLĄD • SKUP Z PANELU • SPRZEDAŻ I DOSTAWA JESZCZE NIEUSTAWIONE';
    document.querySelector('.center p:last-child').textContent = 'Dane: ' + new Date(lastSuccess).toLocaleString('pl-PL');
    const unassigned = gold.filter(p => !p.category && !Number.isFinite(p.familyIndex)).length;
    if (unassigned) status.textContent += ' • ' + unassigned + ' monet wymaga przypisania kategorii';
  } catch (error) {
    status.textContent = lastSuccess ? 'BŁĄD AKTUALIZACJI • OSTATNI ODCZYT: ' + new Date(lastSuccess).toLocaleTimeString('pl-PL') : 'BRAK POŁĄCZENIA Z PANELEM • WIDOCZNE CENY SĄ PRZYKŁADOWE';
  } finally { deadline = Date.now() + 60000; }
}
refresh();
setInterval(() => { if (Date.now() >= deadline) { deadline = Infinity; refresh(); } }, 1000);
