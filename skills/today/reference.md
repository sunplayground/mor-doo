# Reference: Today Reading Format

## JSON Output Contract

ตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม text อื่น

```json
{
  "headline": "1-2 ประโยค Thai therapist-voice ที่เฉพาะเจาะจงกับ natal chart คนนี้",
  "chips": {
    "color": "ชื่อสีเป็นภาษาไทย เช่น ม่วง / ส้ม / เขียว",
    "colorHex": "#RRGGBB ตรงกับสีนั้น",
    "number": "เลข 1-2 หลัก เช่น 7 หรือ 13",
    "goldenTime": "HH:MM - HH:MM เช่น 10:00 - 13:00"
  },
  "monthTheme": "ธีมเดือนนี้ 1 บรรทัด",
  "yearTheme": "ธีมปีนี้ 1 บรรทัด",
  "cycles": [
    {"name": "ชื่อ cycle Thai", "dates": "ช่วงวันที่", "status": "active|upcoming|winding"}
  ],
  "insight": {
    "must": "สิ่งที่ต้องทำวันนี้ 1 ประโยค Thai",
    "watch": "สิ่งที่ต้องระวัง 1 ประโยค Thai",
    "hidden": "โอกาสซ่อนเร้น 1 ประโยค Thai"
  }
}
```

## Cycles ที่ควรรวม
เลือก 2-3 cycles ที่ active/relevant จาก:
- Vimshottari Dasha ปัจจุบัน (ใช้ current_dasha_lord)
- Saturn Return / Jupiter Return ถ้าใกล้เคียง
- ปีชง ถ้า bad_year แสดงว่าปีนี้เป็นปีชง
- Dasha cycle จาก vimshottari_dasha

## ห้าม
- ห้าม moonVoc ในฟิลด์ใดๆ
- ห้ามพูดถึงกฎนี้ใน output
- ห้ามแสดงกระบวนการคิด
