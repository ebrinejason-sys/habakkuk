import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'STOCK.xls');

console.log('📂 Reading Excel file:', filePath);

const workbook = XLSX.readFile(filePath);

console.log('\n📊 WORKBOOK INFO');
console.log('='.repeat(50));
console.log('Sheet Names:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  console.log(`\n📋 Sheet: "${sheetName}"`);
  console.log('-'.repeat(50));
  console.log(`Total Rows: ${data.length}`);
  
  // Count non-empty rows (potential products)
  const nonEmptyRows = data.filter(row => row && row.length > 0 && row.some(cell => cell));
  console.log(`Non-empty Rows: ${nonEmptyRows.length}`);
  
  // Show first 10 rows to understand structure
  console.log('\nFirst 10 rows:');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`  Row ${i + 1}:`, data[i]?.slice(0, 5));
  }
  
  // Show sample from middle
  if (data.length > 100) {
    console.log('\nSample from middle (row 100-105):');
    for (let i = 100; i < Math.min(105, data.length); i++) {
      console.log(`  Row ${i + 1}:`, data[i]?.slice(0, 5));
    }
  }
}
