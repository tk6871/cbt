export const coolingRecordPrefix = 'school-cooling::';
export const coolingRecordId = (id: string) => id.startsWith(coolingRecordPrefix) ? id : `${coolingRecordPrefix}${id}`;
export const isCoolingRecord = (id: string) => id.startsWith(coolingRecordPrefix);
export const coolingOriginalId = (id: string) => isCoolingRecord(id) ? id.slice(coolingRecordPrefix.length) : id;
