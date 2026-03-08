import html2pdf from 'html2pdf.js';

export const generateHtmlPdf = (
  title: string, 
  reportPeriod: string, 
  summary: Record<string, any>, 
  headers: string[], 
  rows: string[][], 
  filename: string, 
  isRTL: boolean,
  t: any
) => {
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  
  let summaryHtml = '<div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">';
  for (const [key, value] of Object.entries(summary)) {
    summaryHtml += `<div style="flex: 1; min-width: 120px;"><strong>${key}:</strong> <span style="color: #111827; font-weight: 600;">${value}</span></div>`;
  }
  summaryHtml += '</div>';

  let tableHtml = `<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #e5e7eb; text-align: ${align};">`;
      
  headers.forEach(h => {
    tableHtml += `<th style="padding: 8px; border: 1px solid #d1d5db; font-weight: bold; color: #374151;">${h}</th>`;
  });
  
  tableHtml += `</tr></thead><tbody>`;
  
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    tableHtml += `<tr style="background-color: ${bg};">`;
    row.forEach(cell => {
      // Replace newlines with <br> for HTML rendering
      const cellContent = typeof cell === 'string' ? cell.replace(/\n/g, '<br>') : cell;
      tableHtml += `<td style="padding: 8px; border: 1px solid #d1d5db; vertical-align: top; color: #111827;">${cellContent}</td>`;
    });
    tableHtml += `</tr>`;
  });
  
  tableHtml += `</tbody></table>`;

  const htmlContent = `
    <div style="padding: 20px; font-family: system-ui, -apple-system, sans-serif; direction: ${dir};">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px;">
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px; gap: 15px;">
          <img src="${isRTL ? '/logo.png' : '/logo-en.jpg'}" style="width: 70px; height: 70px; object-fit: contain; border-radius: 4px;" />
          <div>
            <div style="font-size: 18px; font-weight: bold; color: #0284c7; letter-spacing: 0.5px;">${t('company_name', 'Sama Alfurat Industries And Trade Co Ltd')}</div>
            <h1 style="font-size: 24px; font-weight: bold; margin: 5px 0 0 0; color: #111827;">${title}</h1>
          </div>
        </div>
        <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 14px;">${reportPeriod}</p>
        <p style="margin: 0; color: #4b5563; font-size: 12px;">${t('generated_on', 'Generated on')}: ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</p>
      </div>
      <h3 style="font-size: 16px; margin-bottom: 10px; color: #374151;">${t('report_summary', 'Report Summary')}</h3>
      ${summaryHtml}
      <h3 style="font-size: 16px; margin-bottom: 10px; color: #374151;">${t('transactions_details', 'Transaction Details')}</h3>
      ${tableHtml}
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = htmlContent;

  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
  };

  html2pdf().set(opt).from(container).save().catch((err: any) => {
    console.warn('PDF generation warning:', err?.message || err);
  });
};