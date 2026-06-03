import unittest

from timer_cipher import decrypt_code, encrypt_interval, parse_time


class TimeCipherTests(unittest.TestCase):
    def test_required_anchor_example(self):
        self.assertEqual(encrypt_interval("19:26", "19:30", "dog"), "absd")
        decoded = decrypt_code("absd", "dog")
        self.assertEqual(decoded.start, "19:26")
        self.assertEqual(decoded.end, "19:30")
        self.assertEqual(str(decoded), "19:26-19:30")

    def test_round_trips_multiple_keys_and_ranges(self):
        cases = [
            ("00:00", "00:00"),
            ("08:15", "09:45"),
            ("19:26", "19:30"),
            ("23:59", "00:00"),
        ]

        for key in ["dog", "cat", "a longer shared key"]:
            for start, end in cases:
                with self.subTest(key=key, start=start, end=end):
                    code = encrypt_interval(start, end, key)
                    self.assertEqual(len(code), 4)
                    self.assertTrue(code.isalpha())
                    decoded = decrypt_code(code, key)
                    self.assertEqual(decoded.start, start)
                    self.assertEqual(decoded.end, end)

    def test_parser_accepts_spaces_around_colon(self):
        self.assertEqual(parse_time("19: 26"), parse_time("19:26"))
        self.assertEqual(parse_time(" 19 : 26 "), parse_time("19:26"))

    def test_rejects_invalid_inputs(self):
        with self.assertRaises(ValueError):
            parse_time("24:00")
        with self.assertRaises(ValueError):
            encrypt_interval("19:26", "19:30", "")
        with self.assertRaises(ValueError):
            decrypt_code("1234", "dog")


if __name__ == "__main__":
    unittest.main()
