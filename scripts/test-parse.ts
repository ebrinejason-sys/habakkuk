
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'prisma/raw_upload.txt');
const fileContent = fs.readFileSync(filePath, 'utf-8');

function parseTallyData(text: string) {
    const lines = text.split('\n');
    const products: any[] = [];

    let currentProduct: any = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.includes("HABAKKUK PHARMACY") || line.includes("Particulars") || line.includes("Closing Balance")) continue;

        // Split by tabs and remove empty entries to align data
        const parts = line.split('\t').map(p => p.trim()).filter(p => p);

        // Expect at least [Particulars, Qty, Rate]
        // Value might be optional or present.
        // Qty should look like "100 bot" or numbers.

        if (parts.length < 2) continue; // Skip header garbage or empty lines

        // Identify columns from right
        // Last might be Value. 2nd last Rate. 3rd last Qty.
        // BUT sometimes parts might be split by spaces if tabs missing.
        // Let's rely on the previous assumption that the file uses tabs.
        // If we assume [Name, Qty, Rate, Value]

        let particulars = parts[0];
        let qtyStr = parts[1];
        let rateStr = parts[2];

        // Check if parts[1] is Qty.
        // regex for qty: number + unit
        if (!/^-?\d/.test(qtyStr)) {
            // Maybe parts[0] was split? 
            // Or maybe parts[1] is something else.
            // But looking at the file, it seems consistently mapped.
            // Let's assume parts[1] is Qty.
        }

        const qtyParts = qtyStr.split(' '); // "100 bot" -> ["100", "bot"]
        const quantity = parseFloat(qtyParts[0]);
        const unit = qtyParts.length > 1 ? qtyParts[1] : "Unit";
        const rate = parseFloat(rateStr || "0");

        const isBatch = (name: string, currentUnit: string | null, rowUnit: string | null) => {
            if (currentUnit && rowUnit && currentUnit.toLowerCase() !== rowUnit.toLowerCase()) {
                return false;
            }
            // Batches are usually short
            if (name.length < 15 && /^[A-Z0-9\-\/]+$/.test(name)) return true;
            if (/^\d{4,}/.test(name)) return true;
            return false;
        };

        let isBatchRow = false;
        if (currentProduct) {
            isBatchRow = isBatch(particulars, currentProduct.unit, unit);
        }

        if (!currentProduct || !isBatchRow) {
            if (currentProduct) products.push(currentProduct);
            currentProduct = {
                name: particulars,
                totalQuantity: quantity,
                unit,
                rate,
                batches: []
            };
        } else {
            currentProduct.batches.push({
                batchNumber: particulars,
                quantity,
                unit,
                rate,
                expiry: null
            });
        }
    }
    if (currentProduct) products.push(currentProduct);
    return products;
}

const parsed = parseTallyData(fileContent);

// Check D5
const d5 = parsed.find((p: any) => p.name === "D5");
console.log("D5 Product:", d5 ? "Found" : "Not Found");
if (d5) console.log(JSON.stringify(d5, null, 2));

const curamol = parsed.find((p: any) => p.name === "CURAMOL TBS");
console.log("CURAMOL TBS:", curamol ? "Found" : "Not Found");
if (curamol) console.log(JSON.stringify(curamol, null, 2));

console.log("Total Products:", parsed.length);
