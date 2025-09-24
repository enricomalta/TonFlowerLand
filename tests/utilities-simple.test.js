import { jest } from '@jest/globals';

describe('Utility Functions Tests', () => {
    // Mock utility functions
    const ValidationUtils = {
        isValidWalletAddress: (address) => {
            if (!address || typeof address !== 'string') return false;
            return address.startsWith('EQ') && address.length > 10;
        },
        isValidEmail: (email) => {
            if (!email || typeof email !== 'string') return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        isValidAmount: (amount) => {
            if (typeof amount === 'string') return !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
            return typeof amount === 'number' && amount > 0;
        },
        sanitizeString: (str) => {
            if (!str) return '';
            return str.toString().replace(/[<>'"]/g, '');
        },
        formatCurrency: (amount) => {
            if (isNaN(amount)) return 'NaN';
            return Number(amount).toFixed(2);
        },
        generateUniqueId: () => {
            return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },
        validateInventoryFormat: (format) => {
            if (!format || typeof format !== 'string') return false;
            const parts = format.split(':');
            if (parts.length !== 2) return false;
            const name = parts[0].trim();
            const quantity = parseInt(parts[1].trim());
            return name.length > 0 && !isNaN(quantity) && quantity >= 0;
        },
        calculateGrowthStage: (plantedTime, currentTime) => {
            const hoursDiff = (currentTime - plantedTime) / (1000 * 60 * 60);
            return Math.min(Math.floor(hoursDiff), 3);
        },
        calculateRewards: (plantType, stage) => {
            const baseReward = plantType * 10;
            const stageMultiplier = stage + 1;
            return baseReward * stageMultiplier;
        },
        isValidSlotId: (slotId) => {
            return typeof slotId === 'number' && slotId >= 0 && slotId < 100;
        }
    };

    const TimeUtils = {
        getCurrentTime: () => Date.now(),
        addHours: (date, hours) => {
            const newDate = new Date(date);
            newDate.setUTCHours(newDate.getUTCHours() + hours);
            return newDate;
        },
        formatTimestamp: (timestamp) => {
            return new Date(timestamp).toISOString();
        },
        isExpired: (timestamp, durationMs) => {
            return Date.now() - timestamp > durationMs;
        },
        getTimeDifference: (start, end) => {
            return end - start;
        }
    };

    const DataUtils = {
        deepClone: (obj) => {
            if (obj === null) return null;
            return JSON.parse(JSON.stringify(obj));
        },
        mergeObjects: (obj1, obj2) => {
            return { ...obj1, ...obj2 };
        },
        filterNullValues: (obj) => {
            const filtered = {};
            for (const key in obj) {
                if (obj[key] != null) {
                    filtered[key] = obj[key];
                }
            }
            return filtered;
        },
        arrayToObject: (arr, keyField) => {
            const result = {};
            arr.forEach(item => {
                result[item[keyField]] = item;
            });
            return result;
        },
        groupBy: (arr, keyField) => {
            const groups = {};
            arr.forEach(item => {
                const key = item[keyField];
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });
            return groups;
        }
    };

    const NetworkUtils = {
        isValidUrl: (url) => {
            if (!url || typeof url !== 'string') return false;
            try {
                new URL(url);
                return url.startsWith('http://') || url.startsWith('https://');
            } catch {
                return false;
            }
        },
        extractDomain: (url) => {
            if (!url) return null;
            try {
                return new URL(url).hostname;
            } catch {
                return null;
            }
        },
        buildQueryString: (params) => {
            const query = new URLSearchParams(params);
            return query.toString();
        }
    };

    describe('ValidationUtils', () => {
        test('should validate wallet addresses correctly', () => {
            const validAddresses = [
                'EQD1234567890abcdef',
                'EQTest123456789'
            ];

            const invalidAddresses = [
                'invalid-address',
                'BTC1234567890',
                '',
                null,
                undefined
            ];

            validAddresses.forEach(address => {
                expect(ValidationUtils.isValidWalletAddress(address)).toBe(true);
            });

            invalidAddresses.forEach(address => {
                expect(ValidationUtils.isValidWalletAddress(address)).toBe(false);
            });
        });

        test('should validate email addresses correctly', () => {
            const validEmails = [
                'user@example.com',
                'test.email@domain.org'
            ];

            const invalidEmails = [
                'invalid-email',
                '@domain.com',
                'user@',
                ''
            ];

            validEmails.forEach(email => {
                expect(ValidationUtils.isValidEmail(email)).toBe(true);
            });

            invalidEmails.forEach(email => {
                expect(ValidationUtils.isValidEmail(email)).toBe(false);
            });
        });

        test('should validate amounts correctly', () => {
            const validAmounts = [
                10,
                5.5,
                '100',
                '25.75'
            ];

            const invalidAmounts = [
                0,
                -1,
                'invalid',
                '',
                null
            ];

            validAmounts.forEach(amount => {
                expect(ValidationUtils.isValidAmount(amount)).toBe(true);
            });

            invalidAmounts.forEach(amount => {
                expect(ValidationUtils.isValidAmount(amount)).toBe(false);
            });
        });

        test('should sanitize strings correctly', () => {
            const testCases = [
                { input: 'normal text', expected: 'normal text' },
                { input: '<script>alert("xss")</script>', expected: 'scriptalert(xss)/script' },
                { input: "It's a test", expected: 'Its a test' },
                { input: '', expected: '' },
                { input: null, expected: '' }
            ];

            testCases.forEach(({ input, expected }) => {
                expect(ValidationUtils.sanitizeString(input)).toBe(expected);
            });
        });

        test('should format currency correctly', () => {
            const testCases = [
                { input: 10, expected: '10.00' },
                { input: 10.5, expected: '10.50' },
                { input: 10.554, expected: '10.55' },
                { input: 0, expected: '0.00' }
            ];

            testCases.forEach(({ input, expected }) => {
                expect(ValidationUtils.formatCurrency(input)).toBe(expected);
            });
        });

        test('should generate unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                const id = ValidationUtils.generateUniqueId();
                expect(id).toMatch(/^id_\d+_[a-z0-9]+$/);
                expect(ids.has(id)).toBe(false);
                ids.add(id);
            }
        });

        test('should validate inventory format', () => {
            const validFormats = [
                'Vaso: 5',
                'Semente Rosa: 10',
                'Anti-Parasita: 0'
            ];

            const invalidFormats = [
                'Vaso',
                ': 5',
                'Vaso: -1',
                'Vaso: ABC'
            ];

            validFormats.forEach(format => {
                expect(ValidationUtils.validateInventoryFormat(format)).toBe(true);
            });

            invalidFormats.forEach(format => {
                expect(ValidationUtils.validateInventoryFormat(format)).toBe(false);
            });
        });
    });

    describe('TimeUtils', () => {
        test('should return current time', () => {
            const time = TimeUtils.getCurrentTime();
            expect(typeof time).toBe('number');
            expect(time).toBeGreaterThan(0);
        });

        test('should add hours correctly', () => {
            const baseDate = new Date('2024-01-01T10:00:00.000Z');
            const result = TimeUtils.addHours(baseDate, 5);
            
            expect(result.getUTCHours()).toBe(15);
            expect(result.toISOString()).toBe('2024-01-01T15:00:00.000Z');
        });

        test('should format timestamps correctly', () => {
            const timestamp = new Date('2024-01-01T10:30:45Z').getTime();
            const formatted = TimeUtils.formatTimestamp(timestamp);
            
            expect(formatted).toBe('2024-01-01T10:30:45.000Z');
        });

        test('should check expiration correctly', () => {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            expect(TimeUtils.isExpired(oneHourAgo, 30 * 60 * 1000)).toBe(true); // 30 min duration
            expect(TimeUtils.isExpired(oneHourAgo, 2 * 60 * 60 * 1000)).toBe(false); // 2 hour duration
        });
    });

    describe('DataUtils', () => {
        test('should deep clone objects correctly', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = DataUtils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.b).not.toBe(original.b);
        });

        test('should handle null inputs', () => {
            expect(DataUtils.deepClone(null)).toBe(null);
        });

        test('should merge objects correctly', () => {
            const obj1 = { a: 1, b: 2 };
            const obj2 = { b: 3, c: 4 };
            const merged = DataUtils.mergeObjects(obj1, obj2);
            
            expect(merged).toEqual({ a: 1, b: 3, c: 4 });
        });

        test('should filter null values', () => {
            const obj = { a: 1, b: null, c: undefined, d: 'test' };
            const filtered = DataUtils.filterNullValues(obj);
            
            expect(filtered).toEqual({ a: 1, d: 'test' });
        });
    });

    describe('NetworkUtils', () => {
        test('should validate URLs correctly', () => {
            const validUrls = [
                'https://example.com',
                'http://localhost:3000'
            ];

            const invalidUrls = [
                'invalid-url',
                'not-a-url'
            ];

            validUrls.forEach(url => {
                expect(NetworkUtils.isValidUrl(url)).toBe(true);
            });

            invalidUrls.forEach(url => {
                expect(NetworkUtils.isValidUrl(url)).toBe(false);
            });
        });

        test('should extract domain from URLs', () => {
            const testCases = [
                { url: 'https://example.com/path', expected: 'example.com' },
                { url: 'http://localhost:3000', expected: 'localhost' },
                { url: null, expected: null }
            ];

            testCases.forEach(({ url, expected }) => {
                expect(NetworkUtils.extractDomain(url)).toBe(expected);
            });
        });

        test('should build query strings correctly', () => {
            const params = { page: 1, limit: 10, search: 'test' };
            const queryString = NetworkUtils.buildQueryString(params);
            
            expect(queryString).toContain('page=1');
            expect(queryString).toContain('limit=10');
            expect(queryString).toContain('search=test');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle empty inputs gracefully', () => {
            expect(ValidationUtils.sanitizeString('')).toBe('');
            expect(ValidationUtils.isValidWalletAddress('')).toBe(false);
            expect(DataUtils.filterNullValues({})).toEqual({});
        });

        test('should handle null/undefined inputs', () => {
            expect(ValidationUtils.sanitizeString(null)).toBe('');
            expect(ValidationUtils.isValidWalletAddress(null)).toBe(false);
            expect(DataUtils.deepClone(null)).toBe(null);
            expect(NetworkUtils.extractDomain(null)).toBe(null);
        });

        test('should handle type mismatches', () => {
            expect(ValidationUtils.isValidAmount('not-a-number')).toBe(false);
            expect(ValidationUtils.formatCurrency('invalid')).toBe('NaN');
            expect(NetworkUtils.isValidUrl(123)).toBe(false);
        });

        test('should handle boundary values', () => {
            expect(ValidationUtils.isValidAmount(0.01)).toBe(true);
            expect(ValidationUtils.calculateGrowthStage(0, 1000)).toBe(0);
            expect(ValidationUtils.isValidSlotId(99)).toBe(true);
            expect(ValidationUtils.isValidSlotId(100)).toBe(false);
        });
    });
});