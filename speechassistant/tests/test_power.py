import unittest

from speechassistant.power import parse_pmset_batt


class TestPower(unittest.TestCase):
    def test_parse_ac(self):
        self.assertEqual(parse_pmset_batt("Now drawing from 'AC Power'"), "ac")

    def test_parse_battery(self):
        self.assertEqual(parse_pmset_batt("Now drawing from 'Battery Power'"), "battery")

    def test_parse_unknown(self):
        self.assertEqual(parse_pmset_batt("nope"), "unknown")


if __name__ == "__main__":
    unittest.main()

