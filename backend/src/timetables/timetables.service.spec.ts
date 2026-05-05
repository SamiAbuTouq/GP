// Unit tests for exported pure helpers in the Timetables module.
import { decodeDaysMask, decodeSemesterType } from './timetables.service';

describe('timetables.service pure helpers', () => {
  describe('decodeDaysMask', () => {
    it('returns Monday for bit 1', () => {
      expect(decodeDaysMask(0b0000010)).toEqual(['Monday']);
    });

    it('returns Monday and Tuesday for bits 1+2', () => {
      expect(decodeDaysMask(0b0000110)).toEqual(['Monday', 'Tuesday']);
    });

    it('returns an empty array for 0', () => {
      expect(decodeDaysMask(0)).toEqual([]);
    });

    it('returns all seven days in order for all 7 bits', () => {
      expect(decodeDaysMask(0b1111111)).toEqual([
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ]);
    });
  });

  describe('decodeSemesterType', () => {
    it('maps 1 to First Semester', () => {
      expect(decodeSemesterType(1)).toBe('First Semester');
    });

    it('maps 2 to Second Semester', () => {
      expect(decodeSemesterType(2)).toBe('Second Semester');
    });

    it('maps 3 to Summer Semester', () => {
      expect(decodeSemesterType(3)).toBe('Summer Semester');
    });

    it('returns a fallback for unknown values', () => {
      expect(decodeSemesterType(99)).toBe('Semester 99');
    });
  });
});
