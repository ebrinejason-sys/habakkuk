/**
 * Inventory Parser for Habakkuk Pharmacy
 * 
 * This script parses the raw_upload.txt file and:
 * 1. Identifies product lines vs batch lines
 * 2. Normalizes product names
 * 3. Groups similar products
 * 4. Outputs clean data ready for database import
 */

import * as fs from 'fs';
import * as path from 'path';

interface RawEntry {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  value: number;
  isBatchLine: boolean;
  batchNumber?: string;
}

interface CleanProduct {
  name: string;
  normalizedName: string;
  category: string;
  totalQuantity: number;
  unit: string;
  averageRate: number;
  totalValue: number;
  batches: { batchNumber: string; quantity: number; rate: number }[];
  hasNegativeStock: boolean;
}

// Common unit mappings
const UNIT_MAP: Record<string, string> = {
  'tabs': 'Tablets',
  'tab': 'Tablets',
  'tablets': 'Tablets',
  'caps': 'Capsules',
  'cap': 'Capsules',
  'capsules': 'Capsules',
  'bot': 'Bottle',
  'bottle': 'Bottle',
  'bottles': 'Bottle',
  'syrp': 'Syrup',
  'syrup': 'Syrup',
  'amps': 'Ampoule',
  'amp': 'Ampoule',
  'ampoule': 'Ampoule',
  'vial': 'Vial',
  'vials': 'Vial',
  'pkt': 'Packet',
  'pcs': 'Pieces',
  'roll': 'Roll',
  'tubes': 'Tube',
  'tube': 'Tube',
};

// Category detection based on keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Antibiotics': ['amoxicillin', 'ciprofloxacin', 'azithromycin', 'metronidazole', 'cefixime', 'ablevox', 'aciclovir'],
  'Pain Relief': ['aceclofenac', 'paracetamol', 'ibuprofen', 'diclofenac', 'acepar'],
  'Cardiovascular': ['amlodipine', 'amlodac', 'atenolol', 'losartan', 'amloozar'],
  'Antihistamines': ['cetirizine', 'loratadine', 'actizine'],
  'Respiratory': ['aminophylline', 'salbutamol'],
  'Vitamins & Supplements': ['agovit', 'multivitamin', 'vitamin'],
  'Anthelmintics': ['albendazole', 'alzole', 'alwo'],
  'Gastrointestinal': ['alcid', 'antacid', 'omeprazole'],
  'Injectables': ['injection', 'inj', 'adrenaline'],
  'Medical Supplies': ['adhesive', 'plaster', 'bandage', 'gauze', 'cotton'],
  'Antifungals': ['fluconazole', 'clotrimazole'],
  'Other': [],
};

function parseQuantityAndUnit(qtyStr: string): { quantity: number; unit: string } {
  const match = qtyStr.match(/^(-?\d+)\s*(.+)$/);
  if (match) {
    const quantity = parseInt(match[1], 10);
    const rawUnit = match[2].trim().toLowerCase();
    const unit = UNIT_MAP[rawUnit] || rawUnit;
    return { quantity, unit };
  }
  return { quantity: 0, unit: 'Unit' };
}

function normalizeProductName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\d+X\d+/g, '') // Remove pack sizes like 10X10
    .replace(/\d+MG/g, '') // Remove dosage temporarily for matching
    .replace(/\d+ML/g, '')
    .trim();
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

function isBatchLine(line: string): boolean {
  // Batch lines typically:
  // 1. Start with alphanumeric codes (e.g., "27F01525", "G403038")
  // 2. Are shorter and don't contain common drug keywords
  // 3. Don't have descriptive text like "mg", "tablets", "syrup"
  
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Check if it starts with what looks like a batch number
  const batchPattern = /^[A-Z0-9]{2,}[A-Z0-9\-]*$/i;
  const firstWord = trimmed.split(/\s+/)[0];
  
  // If first word looks like a batch code and line doesn't have drug-related keywords
  const drugKeywords = ['mg', 'ml', 'tab', 'cap', 'syr', 'inj', 'cream', 'susp'];
  const hasDrugKeyword = drugKeywords.some(kw => trimmed.toLowerCase().includes(kw));
  
  return batchPattern.test(firstWord) && !hasDrugKeyword && firstWord.length <= 12;
}

function parseFile(filePath: string): RawEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: RawEntry[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and header
    if (!trimmed || trimmed.includes('HABAKKUK PHARMACY') || 
        trimmed.includes('Particulars') || trimmed.includes('Closing Balance') ||
        (trimmed.includes('Quantity') && trimmed.includes('Rate'))) {
      continue;
    }
    
    // Parse tab-separated values
    const parts = line.split('\t').map(p => p.trim()).filter(p => p);
    
    if (parts.length < 2) continue;
    
    // The format varies - try to extract meaningful data
    // Pattern: Name | Qty+Unit | Rate | Value
    // Or: BatchNo | Qty+Unit | Rate | Value
    
    let name = '';
    let qtyStr = '';
    let rate = 0;
    let value = 0;
    
    // Find the quantity field (contains number + unit like "100 bot" or "-481 tabs")
    const qtyPattern = /^-?\d+\s+\w+$/;
    
    for (let i = 0; i < parts.length; i++) {
      if (qtyPattern.test(parts[i])) {
        // Found quantity field
        name = parts.slice(0, i).join(' ').trim() || parts[i - 1] || '';
        qtyStr = parts[i];
        rate = parseFloat(parts[i + 1]?.replace(/,/g, '')) || 0;
        value = parseFloat(parts[i + 2]?.replace(/,/g, '')) || 0;
        break;
      }
    }
    
    // If no quantity found with pattern, try alternative parsing
    if (!qtyStr && parts.length >= 3) {
      // Check if first part ends with qty pattern
      const firstPartMatch = parts[0].match(/^(.+?)\s+(-?\d+\s+\w+)$/);
      if (firstPartMatch) {
        name = firstPartMatch[1];
        qtyStr = firstPartMatch[2];
        rate = parseFloat(parts[1]?.replace(/,/g, '')) || 0;
        value = parseFloat(parts[2]?.replace(/,/g, '')) || 0;
      } else {
        name = parts[0];
        qtyStr = parts[1];
        rate = parseFloat(parts[2]?.replace(/,/g, '')) || 0;
        value = parseFloat(parts[3]?.replace(/,/g, '')) || 0;
      }
    }
    
    const { quantity, unit } = parseQuantityAndUnit(qtyStr);
    const isBatch = isBatchLine(name);
    
    if (name && (quantity !== 0 || rate > 0)) {
      entries.push({
        name: name,
        quantity,
        unit,
        rate,
        value,
        isBatchLine: isBatch,
        batchNumber: isBatch ? name.split(/\s+/)[0] : undefined,
      });
    }
  }
  
  return entries;
}

function groupProducts(entries: RawEntry[]): Map<string, CleanProduct> {
  const products = new Map<string, CleanProduct>();
  let currentProduct: CleanProduct | null = null;
  
  for (const entry of entries) {
    if (!entry.isBatchLine) {
      // This is a product line
      const normalizedName = normalizeProductName(entry.name);
      
      // Check if we already have a similar product
      let existingKey: string | null = null;
      for (const [key, product] of products) {
        if (product.normalizedName === normalizedName || 
            areSimilarProducts(product.name, entry.name)) {
          existingKey = key;
          break;
        }
      }
      
      if (existingKey) {
        // Merge with existing product
        const existing = products.get(existingKey)!;
        existing.totalQuantity += entry.quantity;
        existing.totalValue += entry.value;
        existing.hasNegativeStock = existing.hasNegativeStock || entry.quantity < 0;
        currentProduct = existing;
      } else {
        // Create new product
        const newProduct: CleanProduct = {
          name: entry.name,
          normalizedName,
          category: detectCategory(entry.name),
          totalQuantity: entry.quantity,
          unit: entry.unit,
          averageRate: entry.rate,
          totalValue: entry.value,
          batches: [],
          hasNegativeStock: entry.quantity < 0,
        };
        products.set(entry.name, newProduct);
        currentProduct = newProduct;
      }
    } else if (currentProduct && entry.batchNumber) {
      // This is a batch line - add to current product
      currentProduct.batches.push({
        batchNumber: entry.batchNumber,
        quantity: entry.quantity,
        rate: entry.rate,
      });
    }
  }
  
  // Calculate average rates
  for (const product of products.values()) {
    if (product.totalQuantity !== 0) {
      product.averageRate = Math.abs(product.totalValue / product.totalQuantity);
    }
  }
  
  return products;
}

function areSimilarProducts(name1: string, name2: string): boolean {
  const n1 = normalizeProductName(name1);
  const n2 = normalizeProductName(name2);
  
  // Exact match after normalization
  if (n1 === n2) return true;
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Simple similarity - share significant words
  const words1 = n1.split(' ').filter(w => w.length > 3);
  const words2 = n2.split(' ').filter(w => w.length > 3);
  const commonWords = words1.filter(w => words2.includes(w));
  
  return commonWords.length >= 1 && commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
}

function generateReport(products: Map<string, CleanProduct>): void {
  console.log('\n' + '='.repeat(80));
  console.log('HABAKKUK PHARMACY - INVENTORY ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  // Statistics
  const allProducts = Array.from(products.values());
  const negativeStock = allProducts.filter(p => p.hasNegativeStock);
  const byCategory = new Map<string, CleanProduct[]>();
  
  for (const product of allProducts) {
    const existing = byCategory.get(product.category) || [];
    existing.push(product);
    byCategory.set(product.category, existing);
  }
  
  console.log('\n📊 SUMMARY STATISTICS');
  console.log('-'.repeat(40));
  console.log(`Total Unique Products: ${allProducts.length}`);
  console.log(`Products with Negative Stock: ${negativeStock.length}`);
  console.log(`Total Categories: ${byCategory.size}`);
  
  const totalValue = allProducts.reduce((sum, p) => sum + p.totalValue, 0);
  console.log(`Total Inventory Value: ${totalValue.toLocaleString()}`);
  
  console.log('\n📁 PRODUCTS BY CATEGORY');
  console.log('-'.repeat(40));
  for (const [category, items] of byCategory) {
    const categoryValue = items.reduce((sum, p) => sum + p.totalValue, 0);
    console.log(`${category}: ${items.length} products (Value: ${categoryValue.toLocaleString()})`);
  }
  
  if (negativeStock.length > 0) {
    console.log('\n⚠️  NEGATIVE STOCK ITEMS (REQUIRES ATTENTION)');
    console.log('-'.repeat(40));
    for (const product of negativeStock) {
      console.log(`  - ${product.name}: ${product.totalQuantity} ${product.unit}`);
    }
  }
  
  console.log('\n✅ CLEAN PRODUCTS FOR IMPORT');
  console.log('-'.repeat(40));
  
  // Only show products with positive stock for import
  const validProducts = allProducts.filter(p => p.totalQuantity > 0);
  console.log(`Products ready for import: ${validProducts.length}`);
}

function generateImportData(products: Map<string, CleanProduct>): object[] {
  const importData: object[] = [];
  let skuCounter = 1;
  
  for (const product of products.values()) {
    // Skip negative stock items for now
    if (product.totalQuantity <= 0) continue;
    
    // Generate a clean SKU
    const sku = `HAB-${String(skuCounter++).padStart(5, '0')}`;
    
    importData.push({
      name: product.name.trim(),
      description: `${product.category} - ${product.unit}`,
      category: product.category,
      sku: sku,
      price: Math.round(product.averageRate * 1.3), // 30% markup for selling price
      costPrice: Math.round(product.averageRate),
      quantity: Math.max(0, product.totalQuantity),
      reorderLevel: 10,
      unitOfMeasure: product.unit,
      manufacturer: null,
      batchNumber: product.batches.length > 0 ? product.batches[0].batchNumber : null,
      isActive: true,
    });
  }
  
  return importData;
}

// Main execution
const filePath = path.join(__dirname, '..', 'prisma', 'raw_upload.txt');

console.log('📂 Reading inventory file...');
const entries = parseFile(filePath);
console.log(`   Found ${entries.length} raw entries`);

console.log('🔄 Grouping and normalizing products...');
const products = groupProducts(entries);

generateReport(products);

// Generate import-ready JSON
const importData = generateImportData(products);
const outputPath = path.join(__dirname, '..', 'prisma', 'clean_inventory.json');
fs.writeFileSync(outputPath, JSON.stringify(importData, null, 2));
console.log(`\n💾 Clean inventory saved to: prisma/clean_inventory.json`);
console.log(`   ${importData.length} products ready for database import`);

// Also generate a CSV for manual review
const csvPath = path.join(__dirname, '..', 'prisma', 'inventory_review.csv');
const csvHeader = 'Name,Category,Quantity,Unit,Cost Price,Selling Price,SKU\n';
const csvRows = importData.map((p: any) => 
  `"${p.name}","${p.category}",${p.quantity},"${p.unitOfMeasure}",${p.costPrice},${p.price},"${p.sku}"`
).join('\n');
fs.writeFileSync(csvPath, csvHeader + csvRows);
console.log(`📋 Review CSV saved to: prisma/inventory_review.csv`);
