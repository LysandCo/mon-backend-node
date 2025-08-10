import PDFDocument from 'pdfkit';
import fetch from 'node-fetch';

export const generateInvoiceBuffer = async (params: {
  clientName: string;
  email: string;
  address: string;
  siretNumber: string;
  items: { title: string; quantity: number; price: number; sku?: string }[];
  total: number;
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  orderDate: string;
  paymentMethod: string;
}): Promise<Buffer> => {
  // Charger le logo depuis l’URL
  const logoUrl = 'https://lys-and-co.com/wp-content/uploads/2025/03/logo-lysco.jpg';
  let logoBuffer: Buffer | undefined;
  try {
    const res = await fetch(logoUrl);
    if (res.ok) {
      logoBuffer = await res.buffer();
    }
  } catch {
    logoBuffer = undefined;
  }

  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Définition des couleurs et polices
    const primaryColor = '#f9429e';   // rose pour le header
    const secondaryColor = '#5cb9bc'; // turquoise pour les blocs infos client/facture
    const accentColor = '#f9429e';    // rose pour le total
    const textColor = '#333333';
    const lightTextColor = '#666666';
    const tableHeaderBg = primaryColor;
    const tableHeaderText = '#FFFFFF';
    const tableRowAlt = '#F9FBFD';
    const fontRegular = 'Helvetica';
    const fontBold = 'Helvetica-Bold';

    // HEADER (logo + bande colorée)
    doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);

    // Logo à gauche
    let logoHeight = 0;
    if (logoBuffer) {
      const logoWidth = 120;
      logoHeight = 80;
      doc.image(logoBuffer, 50, 20, { width: logoWidth, height: logoHeight });
    }

    // Nom et adresse Lys&Co à droite, en blanc
    doc
      .font(fontBold)
      .fontSize(18)
      .fillColor('#FFFFFF')
      .text('Lys&Co', doc.page.width - 250, 30, { align: 'right', width: 200 });
    doc
      .font(fontRegular)
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text('28 Rue de l’église', doc.page.width - 250, doc.y + 2, { align: 'right', width: 200 })
      .text('95170 Deuil-la-Barre', doc.page.width - 250, doc.y + 2, { align: 'right', width: 200 })
      .text('Tel : +33 (0)9 53 42 11 63', doc.page.width - 250, doc.y + 2, { align: 'right', width: 200 });

    // Séparateur sous le header
    doc
      .moveTo(50, 100)
      .lineTo(doc.page.width - 50, 100)
      .strokeColor('#FFFFFF')
      .lineWidth(1)
      .stroke();

    // Titre “FACTURE”
    const afterLogoY = 100 + 20;
    doc
      .font(fontBold)
      .fontSize(22)
      .fillColor(textColor)
      .text("FACTURE", 50, afterLogoY);

    // Blocs infos client et facture
    const clientBoxY = afterLogoY + 40;
    const clientBoxHeight = 80;
    const boxWidth = (doc.page.width - 120) / 2;

    // Bloc infos client (fond turquoise)
    doc
      .rect(50, clientBoxY, boxWidth, clientBoxHeight)
      .fill(secondaryColor);

    doc
      .font(fontBold)
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text('Client :', 60, clientBoxY + 10);

    doc
      .font(fontRegular)
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text(params.clientName, 60, doc.y + 2)
      .text(params.address, 60, doc.y + 2)
      .text(params.email, 60, doc.y + 2)
      .text(`SIRET : ${params.siretNumber}`);

    // Bloc infos facture (fond turquoise)
    const invoiceBoxX = 60 + boxWidth;
    doc
      .rect(invoiceBoxX, clientBoxY, boxWidth, clientBoxHeight)
      .fill(secondaryColor);

    const infoLabelX = invoiceBoxX + 10;
    const infoValueX = invoiceBoxX + 110;
    let lineY = clientBoxY + 10;

    doc.font(fontBold).fontSize(10).fillColor('#FFFFFF').text('N° Facture :', infoLabelX, lineY);
    doc.font(fontRegular).fillColor('#FFFFFF').text(params.invoiceNumber, infoValueX, lineY);
    lineY += 14;
    doc.font(fontBold).fillColor('#FFFFFF').text('Date Facture :', infoLabelX, lineY);
    doc.font(fontRegular).fillColor('#FFFFFF').text(params.invoiceDate, infoValueX, lineY);
    lineY += 14;
    doc.font(fontBold).fillColor('#FFFFFF').text('N° Commande :', infoLabelX, lineY);
    doc.font(fontRegular).fillColor('#FFFFFF').text(params.orderNumber, infoValueX, lineY);
    lineY += 14;
    doc.font(fontBold).fillColor('#FFFFFF').text('Date Commande :', infoLabelX, lineY);
    doc.font(fontRegular).fillColor('#FFFFFF').text(params.orderDate, infoValueX, lineY);
    lineY += 14;
    doc.font(fontBold).fillColor('#FFFFFF').text('Paiement :', infoLabelX, lineY);
    doc.font(fontRegular).fillColor('#FFFFFF').text(params.paymentMethod, infoValueX, lineY);

    // TABLEAU PRODUITS
    let tableTop = clientBoxY + clientBoxHeight + 40;
    const col1X = 50;
    const col2X = 300;
    const col3X = 380;
    const col4X = 460;

    // Entête du tableau
    doc
      .rect(col1X, tableTop, doc.page.width - 100, 20)
      .fill(tableHeaderBg);

    doc
      .font(fontBold)
      .fontSize(11)
      .fillColor(tableHeaderText)
      .text('Description', col1X + 5, tableTop + 5)
      .text('Qté', col2X + 5, tableTop + 5)
      .text('Prix Unitaire', col3X + 5, tableTop + 5)
      .text('Total HT', col4X + 5, tableTop + 5);

    // Corps du tableau
    let y = tableTop + 20;
    for (const item of params.items) {
      doc.font(fontRegular).fontSize(10);
      const descWidth = (col2X - col1X - 10);
      const titleHeight = doc.heightOfString(item.title, { width: descWidth });
      let skuHeight = 0;
      if (item.sku) {
        doc.font('Helvetica-Oblique').fontSize(8);
        skuHeight = doc.heightOfString(`SKU : ${item.sku}`, { width: descWidth });
        doc.font(fontRegular).fontSize(10);
      }
      const cellHeight = Math.max(titleHeight + skuHeight + 10, 20);

      // Alternance de couleur
      const bg = ((y - (tableTop + 20)) / cellHeight) % 2 === 0 ? '#FFFFFF' : tableRowAlt;
      doc.rect(col1X, y, doc.page.width - 100, cellHeight).fill(bg);

      // Description
      doc.fillColor(textColor).font(fontRegular).fontSize(10)
        .text(item.title, col1X + 5, y + 5, { width: descWidth });
      if (item.sku) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(lightTextColor)
          .text(`SKU : ${item.sku}`, col1X + 5, y + 5 + titleHeight, { width: descWidth });
      }

      // Qté, Prix Unitaire, Total HT
      doc.font(fontRegular).fontSize(10).fillColor(textColor)
        .text(String(item.quantity), col2X + 5, y + 5, { width: col3X - col2X - 10, align: 'right' })
        .text(`${item.price.toFixed(2)} €`, col3X + 5, y + 5, { width: col4X - col3X - 10, align: 'right' })
        .text(`${(item.price * item.quantity).toFixed(2)} €`, col4X + 5, y + 5, {
          width: (doc.page.width - 50) - col4X - 10,
          align: 'right'
        });

      y += cellHeight;
    }

    // Séparateurs horizontaux
    doc.strokeColor('#DDDDDD').lineWidth(0.5);
    let yLine = tableTop + 20;
    for (const item of params.items) {
      doc.font(fontRegular).fontSize(10);
      const descW = col2X - col1X - 10;
      const th = doc.heightOfString(item.title, { width: descW });
      let sh = 0;
      if (item.sku) {
        doc.font('Helvetica-Oblique').fontSize(8);
        sh = doc.heightOfString(`SKU : ${item.sku}`, { width: descW });
        doc.font(fontRegular).fontSize(10);
      }
      const ch = Math.max(th + sh + 10, 20);
      doc.moveTo(col1X, yLine).lineTo(doc.page.width - 50, yLine).stroke();
      yLine += ch;
    }
    doc.moveTo(col1X, yLine).lineTo(doc.page.width - 50, yLine).stroke();

    // Séparateurs verticaux
    const tableBottom = yLine;
    doc.lineWidth(0.5).strokeColor('#DDDDDD')
      .moveTo(col1X, tableTop).lineTo(col1X, tableBottom).stroke()
      .moveTo(col2X, tableTop).lineTo(col2X, tableBottom).stroke()
      .moveTo(col3X, tableTop).lineTo(col3X, tableBottom).stroke()
      .moveTo(col4X, tableTop).lineTo(col4X, tableBottom).stroke()
      .moveTo(doc.page.width - 50, tableTop).lineTo(doc.page.width - 50, tableBottom).stroke();

    // CALCUL DES TOTALS
    const subtotal = params.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const tva = subtotal * 0.2;
    const totalTTC = subtotal + tva;

    y += 20;
    const totalsXLabel = col3X;
    // Définis la position X de la colonne titre et de la colonne prix
    const totalLabelX = totalsXLabel;
    const totalValueX = doc.page.width - 100; // marge droite

    doc.font(fontBold).fontSize(10).fillColor(textColor)
      .text('Sous-total HT :', totalLabelX, y, { align: 'left' });

    doc.font(fontRegular)
      .text(`${subtotal.toFixed(2)} €`, totalValueX, y, { align: 'right' });

    y += 15;

    doc.font(fontBold)
      .text('TVA (20%) :', totalLabelX, y, { align: 'left' });

    doc.font(fontRegular)
      .text(`${tva.toFixed(2)} €`, totalValueX, y, { align: 'right' });

    y += 15;

    doc.font(fontBold).fontSize(12).fillColor(accentColor)
      .text('Total TTC :', totalLabelX, y, { align: 'left' });

    doc.font(fontBold).fontSize(12)
      .text(`${totalTTC.toFixed(2)} €`, totalValueX, y, { align: 'right' });
    y += 30;  
  
  // FOOTER sur chaque page
    function drawFooter(doc: PDFKit.PDFDocument) {
      const footerMargin = 80; // marge depuis le bas de la page
      const footerY = doc.page.height - footerMargin;
      // const footerY = doc.page.height - 40;
      doc.moveTo(50, footerY - 10)
        .lineTo(doc.page.width - 50, footerY - 10)
        .strokeColor(secondaryColor)
        .lineWidth(1)
        .stroke();

      doc.font(fontRegular)
        .fontSize(9)
        .fillColor(lightTextColor)
        .text(
          'Merci pour votre confiance ! Pour toute question, contactez-nous à contact@lys-and-co.com | +33 (0)9 53 42 11 63',
          30,
          footerY,
          { align: 'center' }
        );
    }
    drawFooter(doc);
    doc.on('pageAdded', () => drawFooter(doc));

    doc.end();
  });
};