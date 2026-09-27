import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Base, Patient, Prescription, PrescriptionIssueReport
from app.routes.reports import developer_status, reset_reports


def local_request(host='127.0.0.1'):
    return Request({'type': 'http', 'method': 'DELETE', 'path': '/', 'headers': [], 'client': (host, 12345)})


class DemoResetTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        for patient_id in (1, 2):
            self.db.add(Patient(id=patient_id, name=f'Test {patient_id}', email=f'test{patient_id}@example.com', password_hash='test-only'))
            self.db.add(Prescription(id=patient_id, patient_id=patient_id, medication='Sample', active=True))
        self.db.commit()
        self.db.add_all([
            PrescriptionIssueReport(patient_id=1, prescription_id=1, issue='Too expensive', status='Submitted'),
            PrescriptionIssueReport(patient_id=1, prescription_id=1, issue='Medical conflicts', status='Under review'),
            PrescriptionIssueReport(patient_id=2, prescription_id=2, issue='No insurance coverage'),
        ])
        self.db.commit()
        self.environment = patch.dict(os.environ, {'RXRESCUE_ENABLE_DEMO_RESET': '1'})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.db.close()
        self.engine.dispose()

    def test_deletes_only_target_reports_and_preserves_patients_and_prescriptions(self):
        self.assertEqual(reset_reports(1, local_request(), self.db), {'patient_id': 1, 'deleted_count': 2})
        # A fresh session represents returning to the account after logout.
        with Session(self.engine) as fresh:
            self.assertEqual(fresh.query(PrescriptionIssueReport).filter_by(patient_id=1).count(), 0)
            self.assertEqual(fresh.query(PrescriptionIssueReport).filter_by(patient_id=2).count(), 1)
            self.assertEqual(fresh.query(Patient).count(), 2)
            self.assertEqual(fresh.query(Prescription).count(), 2)

    def test_reset_is_repeatable_and_new_reports_can_be_saved(self):
        reset_reports(1, local_request(), self.db)
        self.assertEqual(reset_reports(1, local_request(), self.db)['deleted_count'], 0)
        self.db.add(PrescriptionIssueReport(patient_id=1, prescription_id=1, issue='Too expensive'))
        self.db.commit()
        self.assertEqual(reset_reports(1, local_request(), self.db)['deleted_count'], 1)

    def test_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(developer_status(local_request())['report_reset_enabled'])
            with self.assertRaises(HTTPException) as error:
                reset_reports(1, local_request(), self.db)
            self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.query(PrescriptionIssueReport).count(), 3)

    def test_nonlocal_request_is_rejected_even_when_enabled(self):
        self.assertFalse(developer_status(local_request('203.0.113.1'))['report_reset_enabled'])
        with self.assertRaises(HTTPException):
            reset_reports(1, local_request('203.0.113.1'), self.db)
        self.assertEqual(self.db.query(PrescriptionIssueReport).count(), 3)

    def test_enabled_local_status_and_ipv6(self):
        self.assertTrue(developer_status(local_request())['report_reset_enabled'])
        self.assertTrue(developer_status(local_request('::1'))['report_reset_enabled'])

    def test_unknown_patient_does_not_delete_any_reports(self):
        with self.assertRaises(HTTPException) as error:
            reset_reports(999, local_request(), self.db)
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.query(PrescriptionIssueReport).count(), 3)

    def test_failed_commit_rolls_back_deletion(self):
        with patch.object(self.db, 'commit', side_effect=SQLAlchemyError('test failure')):
            with self.assertRaises(HTTPException) as error:
                reset_reports(1, local_request(), self.db)
        self.assertEqual(error.exception.status_code, 500)
        self.assertEqual(self.db.query(PrescriptionIssueReport).count(), 3)


if __name__ == '__main__':
    unittest.main()
