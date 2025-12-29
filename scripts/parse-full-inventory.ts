/**
 * Full Inventory Parser for Habakkuk Pharmacy
 * 
 * Logic:
 * 1. Parse all products from STOCK.xls
 * 2. Deduplicate: Same name + same cost price = merge (cumulative stock)
 * 3. Different cost prices = different products (different brands)
 * 4. Keep negative stock items (will be adjusted later)
 * 5. Generate clean JSON for database import
 * 6. Generate negative stock report for review
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface RawProduct {
  name: string;
  quantity: number;
  rate: number; // cost price
  value: number;
}

interface CleanProduct {
  name: string;
  normalizedName: string;
  description: string;
  category: string;
  sku: string;
  price: number;      // selling price (cost + markup)
  costPrice: number;
  quantity: number;
  reorderLevel: number;
  unitOfMeasure: string;
  manufacturer: string | null;
  batchNumber: string | null;
  isActive: boolean;
  originalEntries: number; // how many entries were merged
}

// Category detection based on keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Antibiotics': ['amoxicillin', 'ciprofloxacin', 'azithromycin', 'metronidazole', 'cefixime', 'ablevox', 'aciclovir', 'ceftriaxone', 'augmentin', 'ampiclox', 'amoxyl', 'ampicillin', 'penicillin', 'doxycycline', 'erythromycin', 'gentamicin', 'cloxacillin', 'fluclox', 'cefuroxime', 'zinnat', 'septrin', 'cotrimoxazole', 'norfloxacin', 'ofloxacin', 'levofloxacin', 'nitrofurantoin', 'lincomycin', 'clindamycin', 'vancomycin', 'meropenem', 'imipenem', 'cefotaxime', 'cefpodoxime', 'azicip', 'zithromax'],
  'Pain Relief & Anti-inflammatory': ['aceclofenac', 'paracetamol', 'ibuprofen', 'diclofenac', 'acepar', 'aspirin', 'piroxicam', 'meloxicam', 'naproxen', 'ketoprofen', 'indomethacin', 'tramadol', 'morphine', 'pethidine', 'codeine', 'dolonex', 'brufen', 'cataflam', 'voltaren', 'feldene', 'ponstan', 'celebrex', 'arcoxia', 'etoricoxib', 'nimesulide'],
  'Cardiovascular': ['amlodipine', 'amlodac', 'atenolol', 'losartan', 'amloozar', 'lisinopril', 'enalapril', 'captopril', 'ramipril', 'nifedipine', 'verapamil', 'diltiazem', 'metoprolol', 'propranolol', 'carvedilol', 'bisoprolol', 'furosemide', 'lasix', 'hydrochlorothiazide', 'spironolactone', 'digoxin', 'warfarin', 'aspirin', 'clopidogrel', 'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'telmisartan', 'valsartan', 'irbesartan', 'candesartan'],
  'Antihistamines & Allergy': ['cetirizine', 'loratadine', 'actizine', 'chlorpheniramine', 'piriton', 'diphenhydramine', 'promethazine', 'phenergan', 'desloratadine', 'fexofenadine', 'levocetirizine', 'hydroxyzine', 'clemastine', 'cyproheptadine'],
  'Respiratory': ['aminophylline', 'salbutamol', 'ventolin', 'theophylline', 'montelukast', 'fluticasone', 'budesonide', 'beclomethasone', 'ipratropium', 'terbutaline', 'salmeterol', 'formoterol', 'tiotropium', 'bromhexine', 'ambroxol', 'guaifenesin', 'dextromethorphan', 'codeine', 'antitussive', 'cough'],
  'Vitamins & Supplements': ['agovit', 'multivitamin', 'vitamin', 'folic', 'iron', 'calcium', 'zinc', 'ferrous', 'b-complex', 'ascorbic', 'vit c', 'vit b', 'vit d', 'vit e', 'vit a', 'omega', 'prenatal', 'neurobion', 'becosule', 'supradyn'],
  'Anthelmintics & Antiparasitics': ['albendazole', 'alzole', 'alwo', 'mebendazole', 'praziquantel', 'ivermectin', 'levamisole', 'pyrantel', 'niclosamide', 'zentel', 'vermox'],
  'Gastrointestinal': ['alcid', 'antacid', 'omeprazole', 'pantoprazole', 'esomeprazole', 'rabeprazole', 'lansoprazole', 'ranitidine', 'famotidine', 'cimetidine', 'domperidone', 'metoclopramide', 'loperamide', 'imodium', 'buscopan', 'hyoscine', 'maalox', 'gaviscon', 'sucralfate', 'misoprostol', 'lactulose', 'bisacodyl', 'senna', 'dulcolax', 'ors', 'oral rehydration', 'zinc'],
  'Antifungals': ['fluconazole', 'clotrimazole', 'miconazole', 'ketoconazole', 'itraconazole', 'nystatin', 'terbinafine', 'griseofulvin', 'amphotericin'],
  'Antimalarials': ['artemether', 'lumefantrine', 'coartem', 'quinine', 'chloroquine', 'mefloquine', 'artesunate', 'amodiaquine', 'sulfadoxine', 'pyrimethamine', 'fansidar', 'primaquine', 'lonart', 'p-alaxin', 'duo-cotexcin'],
  'Diabetes': ['metformin', 'glibenclamide', 'glimepiride', 'gliclazide', 'glipizide', 'insulin', 'sitagliptin', 'vildagliptin', 'pioglitazone', 'acarbose', 'dapagliflozin', 'empagliflozin', 'glucophage', 'diamicron'],
  'Dermatology': ['betamethasone', 'hydrocortisone', 'clobetasol', 'mometasone', 'triamcinolone', 'calamine', 'zinc oxide', 'salicylic', 'benzoyl', 'tretinoin', 'permethrin', 'benzyl benzoate', 'whitfield', 'antifungal cream', 'antifungal ointment'],
  'Injectables': ['injection', 'inj', 'adrenaline', 'atropine', 'dexamethasone', 'hydrocortisone inj', 'diazepam inj', 'phenobarbital', 'magnesium sulphate', 'oxytocin', 'ergometrine', 'lignocaine', 'lidocaine', 'xylocaine', 'water for injection', 'normal saline', 'ringers', 'dextrose', 'glucose'],
  'Medical Supplies': ['adhesive', 'plaster', 'bandage', 'gauze', 'cotton', 'syringe', 'needle', 'glove', 'catheter', 'cannula', 'tube', 'mask', 'surgical', 'suture', 'blade', 'scissors', 'forceps', 'thermometer', 'bp apparatus', 'stethoscope'],
  'Eye & ENT': ['eye drop', 'ear drop', 'chloramphenicol eye', 'gentamicin eye', 'ciprofloxacin eye', 'tobramycin', 'dexamethasone eye', 'prednisolone eye', 'timolol', 'pilocarpine', 'atropine eye', 'artificial tears', 'nasal', 'otrivin', 'nasivion'],
  'Hormones & Contraceptives': ['contraceptive', 'family planning', 'levonorgestrel', 'ethinyl', 'norethisterone', 'depo', 'medroxyprogesterone', 'progesterone', 'estrogen', 'clomiphene', 'misoprostol', 'mifepristone', 'thyroxine', 'levothyroxine', 'prednisolone', 'dexamethasone', 'hydrocortisone', 'testosterone', 'estradiol'],
  'Antipsychotics & CNS': ['amitriptyline', 'diazepam', 'lorazepam', 'clonazepam', 'alprazolam', 'phenobarbital', 'carbamazepine', 'phenytoin', 'valproate', 'lamotrigine', 'levetiracetam', 'gabapentin', 'haloperidol', 'chlorpromazine', 'risperidone', 'olanzapine', 'quetiapine', 'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'venlafaxine', 'duloxetine'],
  'Antiretrovirals': ['arv', 'tenofovir', 'lamivudine', 'efavirenz', 'nevirapine', 'zidovudine', 'abacavir', 'atazanavir', 'lopinavir', 'ritonavir', 'dolutegravir', 'raltegravir', 'emtricitabine'],
};

// Unit detection from product name or quantity string
function detectUnit(name: string, qtyStr?: string): string {
  const lowerName = name.toLowerCase();
  const lowerQty = (qtyStr || '').toLowerCase();
  const combined = `${lowerName} ${lowerQty}`;
  
  if (combined.includes('tab') || combined.includes('caplet')) return 'Tablets';
  if (combined.includes('cap') && !combined.includes('caplet')) return 'Capsules';
  if (combined.includes('bot') || combined.includes('bottle')) return 'Bottle';
  if (combined.includes('syr') || combined.includes('susp')) return 'Bottle';
  if (combined.includes('amp')) return 'Ampoule';
  if (combined.includes('vial')) return 'Vial';
  if (combined.includes('tube') || combined.includes('cream') || combined.includes('oint') || combined.includes('gel')) return 'Tube';
  if (combined.includes('pkt') || combined.includes('pack') || combined.includes('sachet')) return 'Packet';
  if (combined.includes('roll')) return 'Roll';
  if (combined.includes('pcs') || combined.includes('piece')) return 'Pieces';
  if (combined.includes('inj')) return 'Ampoule';
  if (combined.includes('drop')) return 'Bottle';
  if (combined.includes('spray')) return 'Bottle';
  if (combined.includes('inhaler')) return 'Inhaler';
  
  return 'Unit';
}

function detectCategory(productName: string): string {
  const lowerName = productName.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
}

function normalizeProductName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create a unique key for deduplication: normalized name + rounded cost price
function createProductKey(name: string, costPrice: number): string {
  const normalized = normalizeProductName(name);
  // Round cost price to nearest 10 to handle minor variations
  const roundedPrice = Math.round(costPrice / 10) * 10;
  return `${normalized}|${roundedPrice}`;
}

function parseExcelFile(filePath: string): RawProduct[] {
  console.log('📂 Reading Excel file:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Stock Summary'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  const products: RawProduct[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;
    
    // Skip headers and non-product rows
    if (row[0] === 'Particulars' || row[2] === 'Closing Balance' || 
        row[2] === 'Quantity' || String(row[0]).includes('HABAKKUK') ||
        String(row[0]).toLowerCase().includes('grand total')) {
      continue;
    }
    
    // Product line: has name in col 0, empty col 1, qty in col 2
    const isProductLine = row[1] === undefined || row[1] === null || row[1] === '';
    
    if (isProductLine && row[0] && typeof row[0] === 'string' && row[0].trim()) {
      const name = String(row[0]).trim();
      const quantity = Number(row[2]) || 0;
      const rate = Number(row[3]) || 0;
      const value = Number(row[4]) || 0;
      
      // Skip if no meaningful data
      if (!name || (quantity === 0 && rate === 0)) continue;
      
      products.push({ name, quantity, rate, value });
    }
  }
  
  console.log(`   Found ${products.length} product entries`);
  return products;
}

function deduplicateProducts(rawProducts: RawProduct[]): Map<string, CleanProduct> {
  const productMap = new Map<string, CleanProduct>();
  let skuCounter = 1;
  
  for (const raw of rawProducts) {
    const key = createProductKey(raw.name, raw.rate);
    
    if (productMap.has(key)) {
      // Merge: same product, same cost price
      const existing = productMap.get(key)!;
      existing.quantity += raw.quantity;
      existing.originalEntries++;
      
      // Update description if this entry has a better name
      if (raw.name.length > existing.name.length) {
        existing.name = raw.name;
      }
    } else {
      // New product
      const sku = `HAB-${String(skuCounter++).padStart(5, '0')}`;
      const category = detectCategory(raw.name);
      const unit = detectUnit(raw.name);
      
      // Calculate selling price with 30% markup
      const sellingPrice = Math.round(raw.rate * 1.3);
      
      const product: CleanProduct = {
        name: raw.name.trim(),
        normalizedName: normalizeProductName(raw.name),
        description: `${category} - ${unit}`,
        category,
        sku,
        price: sellingPrice,
        costPrice: Math.round(raw.rate),
        quantity: raw.quantity,
        reorderLevel: 10,
        unitOfMeasure: unit,
        manufacturer: null,
        batchNumber: null,
        isActive: true,
        originalEntries: 1,
      };
      
      productMap.set(key, product);
    }
  }
  
  return productMap;
}

function generateReport(products: CleanProduct[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('HABAKKUK PHARMACY - FULL INVENTORY ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  const negativeStock = products.filter(p => p.quantity < 0);
  const positiveStock = products.filter(p => p.quantity > 0);
  const zeroStock = products.filter(p => p.quantity === 0);
  
  const byCategory = new Map<string, CleanProduct[]>();
  for (const product of products) {
    const existing = byCategory.get(product.category) || [];
    existing.push(product);
    byCategory.set(product.category, existing);
  }
  
  console.log('\n📊 SUMMARY STATISTICS');
  console.log('-'.repeat(50));
  console.log(`Total Unique Products (after dedup): ${products.length}`);
  console.log(`Products with Positive Stock: ${positiveStock.length}`);
  console.log(`Products with Zero Stock: ${zeroStock.length}`);
  console.log(`Products with Negative Stock: ${negativeStock.length}`);
  
  const totalValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const positiveValue = positiveStock.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  console.log(`\nTotal Inventory Value: ${totalValue.toLocaleString()} UGX`);
  console.log(`Positive Stock Value: ${positiveValue.toLocaleString()} UGX`);
  
  console.log('\n📁 PRODUCTS BY CATEGORY');
  console.log('-'.repeat(50));
  const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [category, items] of sortedCategories) {
    const categoryValue = items.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
    const positive = items.filter(p => p.quantity > 0).length;
    console.log(`${category.padEnd(35)} | ${String(items.length).padStart(4)} products | ${String(positive).padStart(4)} in stock | Value: ${categoryValue.toLocaleString()}`);
  }
  
  // Merged products count
  const merged = products.filter(p => p.originalEntries > 1);
  console.log(`\n🔄 MERGED PRODUCTS: ${merged.length}`);
  if (merged.length > 0) {
    console.log('-'.repeat(50));
    for (const p of merged.slice(0, 20)) {
      console.log(`  ${p.name.substring(0, 40).padEnd(40)} | Merged ${p.originalEntries} entries | Total Qty: ${p.quantity}`);
    }
    if (merged.length > 20) {
      console.log(`  ... and ${merged.length - 20} more`);
    }
  }
}

function generateNegativeStockReport(products: CleanProduct[], outputPath: string): void {
  const negativeStock = products.filter(p => p.quantity < 0).sort((a, b) => a.quantity - b.quantity);
  
  console.log(`\n⚠️  NEGATIVE STOCK REPORT: ${negativeStock.length} items`);
  console.log('-'.repeat(50));
  
  let report = 'HABAKKUK PHARMACY - NEGATIVE STOCK REPORT\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Total Items with Negative Stock: ${negativeStock.length}\n\n`;
  report += '='.repeat(100) + '\n';
  report += 'SKU'.padEnd(12) + 'Product Name'.padEnd(45) + 'Quantity'.padStart(10) + 'Cost Price'.padStart(12) + 'Category'.padEnd(25) + '\n';
  report += '='.repeat(100) + '\n';
  
  let totalNegativeValue = 0;
  
  for (const p of negativeStock) {
    const value = p.quantity * p.costPrice;
    totalNegativeValue += value;
    
    report += `${p.sku.padEnd(12)}${p.name.substring(0, 43).padEnd(45)}${String(p.quantity).padStart(10)}${String(p.costPrice).padStart(12)}${p.category.padEnd(25)}\n`;
    
    // Console preview
    if (negativeStock.indexOf(p) < 15) {
      console.log(`  ${p.sku} | ${p.name.substring(0, 35).padEnd(35)} | Qty: ${String(p.quantity).padStart(6)} | ${p.category}`);
    }
  }
  
  if (negativeStock.length > 15) {
    console.log(`  ... and ${negativeStock.length - 15} more items`);
  }
  
  report += '\n' + '='.repeat(100) + '\n';
  report += `TOTAL NEGATIVE VALUE: ${totalNegativeValue.toLocaleString()} UGX\n`;
  report += '\nACTION REQUIRED:\n';
  report += '- Review each item and determine correct stock levels\n';
  report += '- Check for sales that were not properly recorded\n';
  report += '- Verify against physical stock count\n';
  report += '- Adjust stock levels in the system after verification\n';
  
  fs.writeFileSync(outputPath, report);
  console.log(`\n📝 Negative stock report saved to: ${outputPath}`);
  console.log(`   Total negative value: ${totalNegativeValue.toLocaleString()} UGX`);
}

function generateDatabaseImport(products: CleanProduct[], outputPath: string): void {
  // Prepare data for Prisma import (without internal tracking fields)
  const importData = products.map(p => ({
    name: p.name,
    description: p.description,
    category: p.category,
    sku: p.sku,
    price: p.price,
    costPrice: p.costPrice,
    quantity: p.quantity,
    reorderLevel: p.reorderLevel,
    unitOfMeasure: p.unitOfMeasure,
    manufacturer: p.manufacturer,
    batchNumber: p.batchNumber,
    isActive: p.isActive,
  }));
  
  fs.writeFileSync(outputPath, JSON.stringify(importData, null, 2));
  console.log(`\n💾 Database import file saved to: ${outputPath}`);
  console.log(`   ${importData.length} products ready for import`);
}

function generateCSVReport(products: CleanProduct[], outputPath: string): void {
  const csvHeader = 'SKU,Name,Category,Quantity,Unit,Cost Price,Selling Price,Stock Status\n';
  const csvRows = products.map(p => {
    const status = p.quantity < 0 ? 'NEGATIVE' : p.quantity === 0 ? 'ZERO' : p.quantity < 10 ? 'LOW' : 'OK';
    return `"${p.sku}","${p.name.replace(/"/g, '""')}","${p.category}",${p.quantity},"${p.unitOfMeasure}",${p.costPrice},${p.price},"${status}"`;
  }).join('\n');
  
  fs.writeFileSync(outputPath, csvHeader + csvRows);
  console.log(`📋 CSV report saved to: ${outputPath}`);
}

// Main execution
console.log('🏥 HABAKKUK PHARMACY - INVENTORY IMPORT SYSTEM');
console.log('='.repeat(50));

const excelPath = path.join(__dirname, '..', 'STOCK.xls');
const rawProducts = parseExcelFile(excelPath);

console.log('\n🔄 Deduplicating products...');
console.log('   Rule: Same name + same cost price = merge (cumulative stock)');
console.log('   Rule: Same name + different cost price = different product (different brand)');

const productMap = deduplicateProducts(rawProducts);
const products = Array.from(productMap.values());

console.log(`   Reduced from ${rawProducts.length} to ${products.length} unique products`);

generateReport(products);

// Save outputs
const outputDir = path.join(__dirname, '..', 'prisma');
generateDatabaseImport(products, path.join(outputDir, 'full_inventory.json'));
generateCSVReport(products, path.join(outputDir, 'full_inventory.csv'));
generateNegativeStockReport(products, path.join(outputDir, 'negative_stock_report.txt'));

console.log('\n✅ DONE! Files generated:');
console.log('   - prisma/full_inventory.json (for database import)');
console.log('   - prisma/full_inventory.csv (for Excel review)');
console.log('   - prisma/negative_stock_report.txt (items needing attention)');
