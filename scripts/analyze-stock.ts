import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'STOCK.xls');

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Stock Summary'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

// Count products vs batch lines
// Product lines have empty second column, batch lines don't
let productCount = 0;
let batchCount = 0;
let headerSkipped = false;

const products: { name: string; qty: number; rate: number; value: number }[] = [];

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 3) continue;
  
  // Skip headers
  if (row[0] === 'Particulars' || row[2] === 'Closing Balance' || 
      row[2] === 'Quantity' || String(row[0]).includes('HABAKKUK')) {
    continue;
  }
  
  // Product line: has name in col 0, empty col 1, qty in col 2
  // Batch line: has batch# in col 0, qty in col 1
  const isProductLine = row[1] === undefined || row[1] === null || row[1] === '';
  
  if (isProductLine && row[0] && typeof row[0] === 'string' && row[0].trim()) {
    productCount++;
    products.push({
      name: row[0],
      qty: Number(row[2]) || 0,
      rate: Number(row[3]) || 0,
      value: Number(row[4]) || 0
    });
  } else if (row[0] && row[1] !== undefined && row[1] !== null && row[1] !== '') {
    batchCount++;
  }
}

console.log('\n📊 STOCK.xls ANALYSIS');
console.log('='.repeat(50));
console.log(`Total Rows: ${data.length}`);
console.log(`Product Lines: ${productCount}`);
console.log(`Batch Lines: ${batchCount}`);

// Count negative stock
const negativeStock = products.filter(p => p.qty < 0);
const positiveStock = products.filter(p => p.qty > 0);
const zeroStock = products.filter(p => p.qty === 0);

console.log(`\n📦 STOCK STATUS`);
console.log('-'.repeat(50));
console.log(`Products with Positive Stock: ${positiveStock.length}`);
console.log(`Products with Zero Stock: ${zeroStock.length}`);
console.log(`Products with Negative Stock: ${negativeStock.length}`);

// Total inventory value
const totalValue = products.reduce((sum, p) => sum + (p.value || 0), 0);
const positiveValue = positiveStock.reduce((sum, p) => sum + (p.value || 0), 0);
console.log(`\n💰 INVENTORY VALUE`);
console.log('-'.repeat(50));
console.log(`Total Value (all): ${totalValue.toLocaleString()}`);
console.log(`Positive Stock Value: ${positiveValue.toLocaleString()}`);

// Sample of products A-Z
console.log(`\n📋 SAMPLE PRODUCTS (first 20):`);
console.log('-'.repeat(50));
for (let i = 0; i < Math.min(20, products.length); i++) {
  const p = products[i];
  console.log(`  ${i + 1}. ${p.name.substring(0, 40).padEnd(40)} | Qty: ${String(p.qty).padStart(6)} | Value: ${p.value.toLocaleString()}`);
}

// Last 10 products (to see Z products)
console.log(`\n📋 LAST 10 PRODUCTS:`);
console.log('-'.repeat(50));
for (let i = Math.max(0, products.length - 10); i < products.length; i++) {
  const p = products[i];
  console.log(`  ${i + 1}. ${p.name.substring(0, 40).padEnd(40)} | Qty: ${String(p.qty).padStart(6)} | Value: ${p.value.toLocaleString()}`);
}
