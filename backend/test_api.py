import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.test_parser_logic import sample_payload


class ParserApiTests(unittest.TestCase):
    def setUp(self):
        self.profile = patch('backend.main.get_active_model_profile', return_value={
            'profile': 'fixture', 'provider': 'fixture', 'protocol': 'fixture', 'model': 'fixture',
        })
        self.profile.start()
        self.addCleanup(self.profile.stop)
        self.client = TestClient(app)

    def test_health_does_not_call_a_model(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['activeModel']['configured'])

    def test_empty_and_invalid_uploads_are_rejected_before_model_calls(self):
        with patch('backend.main.call_active_model', new_callable=AsyncMock) as model:
            self.assertEqual(self.client.post('/parse').status_code, 400)
            response = self.client.post('/parse', files={'file': ('bad.txt', b'text', 'text/plain')})
            self.assertEqual(response.status_code, 400)
            model.assert_not_called()

    def test_repeated_images_are_parsed_again_and_keep_the_public_contract(self):
        payload = sample_payload()
        with patch('backend.main.call_active_model', new_callable=AsyncMock,
                   return_value=(payload, json.dumps(payload), 1)) as model:
            first = self.client.post('/parse', files={'files': ('page.png', b'fixture-image', 'image/png')})
            second = self.client.post('/parse', files={'files': ('page.png', b'fixture-image', 'image/png')})
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(model.await_count, 2)
        left, right = first.json(), second.json()
        self.assertEqual(left['answerStatus'], 'none')
        self.assertEqual(left['questions'][0]['id'], '37-38')
        self.assertEqual(left['parseMeta']['fileHash'], right['parseMeta']['fileHash'])
        self.assertNotEqual(left['parseMeta']['runId'], right['parseMeta']['runId'])


if __name__ == '__main__':
    unittest.main()
