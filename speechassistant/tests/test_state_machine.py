import unittest

from speechassistant.wake_state import WakeStateMachine


class TestWakeStateMachine(unittest.TestCase):
    def test_wake_then_command(self):
        sm = WakeStateMachine(["小虾米"], armed_timeout_ms=1000)
        d1 = sm.feed_transcript("小虾米", now_ms=0)
        self.assertEqual(d1.type, "woke")
        self.assertEqual(sm.state, "armed")

        d2 = sm.feed_transcript("打开网页", now_ms=200)
        self.assertEqual(d2.type, "command")
        self.assertEqual(d2.text, "打开网页")
        self.assertEqual(sm.state, "idle")

    def test_timeout(self):
        sm = WakeStateMachine(["小虾米"], armed_timeout_ms=500)
        sm.feed_transcript("小虾米", now_ms=0)
        d = sm.tick(now_ms=600)
        self.assertEqual(d.type, "timeout")
        self.assertEqual(sm.state, "idle")


if __name__ == "__main__":
    unittest.main()

