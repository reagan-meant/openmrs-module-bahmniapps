'use strict';

describe("AppointmentServiceController", function () {
    var controller, scope, q, state, appointmentsServiceService, locationService, messagingService,
        locations, specialityService, specialities, ngDialog, appointmentServices, appService, appDescriptor,
        colorsForAppointmentService, appointmentServiceContext;

    beforeEach(function () {
        module('bahmni.appointments');
        inject(function ($controller, $rootScope, $q) {
            controller = $controller;
            scope = $rootScope.$new();
            q = $q;
        });
    });

    beforeEach(function () {
        appointmentsServiceService = jasmine.createSpyObj('appointmentsServiceService', ['save', 'getAllServices']);
        appointmentsServiceService.save.and.returnValue(specUtil.simplePromise({}));
        appointmentServices = [{name: "Oncology", description: "Cancer treatment"}];
        appointmentsServiceService.getAllServices.and.returnValue(specUtil.simplePromise({data: appointmentServices}));
        locationService = jasmine.createSpyObj('locationService', ['getAllByTag']);
        locations = [
            {display: "OPD1", uuid: 1},
            {display: "Registration", uuid: 2}
        ];
        locationService.getAllByTag.and.returnValue(specUtil.simplePromise({data: {results: locations}}));
        messagingService = jasmine.createSpyObj('messagingService', ['showMessage']);
        messagingService.showMessage.and.returnValue({});
        specialityService = jasmine.createSpyObj('specialityService', ['getAllSpecialities']);
        specialities = [{name: 'Cardiology', uuid: '81da9590-3f10-11e4-2908-0800271c1b75'}];
        specialityService.getAllSpecialities.and.returnValue(specUtil.simplePromise({data: specialities}));
        ngDialog = jasmine.createSpyObj('ngDialog', ['close', 'openConfirm']);
        state = jasmine.createSpyObj('$state', ['go']);
        appService = jasmine.createSpyObj('appService', ['getAppDescriptor']);
        appDescriptor = jasmine.createSpyObj('appDescriptor', ['getConfigValue']);
        appService.getAppDescriptor.and.returnValue(appDescriptor);
        colorsForAppointmentService = ['#000000', '#111111', '#ffffff'];
        appDescriptor.getConfigValue.and.callFake(function (key) {
            if (key === 'enableSpecialities') {
                return true;
            } else if (key === 'enableServiceTypes') {
                return true;
            } else if (key === 'colorsForAppointmentService') {
                return colorsForAppointmentService;
            } else if (key == 'enableCalendarView') {
                return true;
            }
        });
    });

    var createController = function () {
        return controller('AppointmentServiceController', {
            $scope: scope,
            $q: q,
            $state: state,
            appointmentsServiceService: appointmentsServiceService,
            locationService: locationService,
            messagingService: messagingService,
            specialityService: specialityService,
            ngDialog: ngDialog,
            appService: appService,
            appointmentServiceContext: appointmentServiceContext
        }
      );
    };

    describe('initialization', function () {
        it('should fetch all appointment locations on initialization', function () {
            expect(scope.locations).toBeUndefined();
            createController();
            expect(locationService.getAllByTag).toHaveBeenCalledWith('Appointment Location');
            expect(scope.locations).toBe(locations);
            expect(scope.enableSpecialities).toBeTruthy();
            expect(scope.enableServiceTypes).toBeTruthy();
            expect(scope.colorsForAppointmentService).toBe(colorsForAppointmentService);
        });

        it("should have default color for appointment service type", function () {
            createController();
            expect(scope.enableCalendarView).toBe(true);
            expect(scope.service.color).toBe("#000000");
            colorsForAppointmentService = undefined;
            createController();
            expect(scope.service.color).toBe("#008000");
            scope.service.color = "#A9A9A9";
            expect(scope.service.color).toBe("#A9A9A9");
        });

        it('should not fetch specialities if not configured', function () {
            appDescriptor.getConfigValue.and.returnValue(false);
            appService.getAppDescriptor.and.returnValue(appDescriptor);
            expect(scope.specialities).toBeUndefined();
            createController();
            expect(specialityService.getAllSpecialities).not.toHaveBeenCalled();
            expect(scope.specialities).toBeUndefined();
        });

        it('should fetch all specialities on initialization if configured', function () {
            expect(scope.specialities).toBeUndefined();
            createController();
            expect(specialityService.getAllSpecialities).toHaveBeenCalled();
            expect(scope.specialities).toBe(specialities);
        });

        it('should fetch all services on initialization', function () {
            expect(scope.services).toBeUndefined();
            createController();
            expect(appointmentsServiceService.getAllServices).toHaveBeenCalled();
            expect(scope.services).toBe(appointmentServices);
        });
    });

    describe('validateServiceName', function () {
        var name;
        beforeEach(function () {
            createController();
            name = jasmine.createSpyObj('name', ['$setValidity']);
            scope.createServiceForm = {name: name};
        });
        it('should validate to true if service name is unique', function () {
            scope.service = {name: 'Cardiology'};
            scope.services = [{name: 'Endocrinology'}];
            scope.validateServiceName();
            expect(name.$setValidity).toHaveBeenCalledWith('uniqueServiceName', true);
        });

        it('should validate to false if service name is already exists', function () {
            scope.service = {name: 'Cardiology'};
            scope.services = [{name: 'Cardiology'}];
            scope.validateServiceName();
            expect(name.$setValidity).toHaveBeenCalledWith('uniqueServiceName', false);
        });

        it('should validate to false if case insensitive service name is exists', function () {
            scope.service = {name: 'CArdIolOgy'};
            scope.services = [{name: 'Cardiology'}];
            scope.validateServiceName();
            expect(name.$setValidity).toHaveBeenCalledWith('uniqueServiceName', false);
        });

        it('should validate to true if service name is empty', function () {
            scope.service = {name: undefined};
            scope.services = {name: 'Endocrinology'};
            scope.validateServiceName();
            expect(name.$setValidity).toHaveBeenCalledWith('uniqueServiceName', true);
        });
    });

    describe('save', function () {
        var serviceTime, serviceMaxLoad;
        beforeEach(function () {
            createController();
            scope.createServiceForm = {$invalid: false};
            serviceTime = jasmine.createSpyObj('serviceTime', ['$setValidity']);
            serviceTime.$invalid = false;
            scope.createServiceForm.serviceTime = serviceTime;
            serviceMaxLoad = jasmine.createSpyObj('serviceMaxLoad', ['$setValidity']);
            serviceMaxLoad.$invalid = false;
            scope.createServiceForm.serviceMaxLoad = serviceMaxLoad;
            scope.service.weeklyAvailability = [];
            scope.service.serviceTypes = [];
        });

        describe('clear incorrect data', function () {
            var startDateTime, endDateTime, serviceResponse;
            beforeEach(function () {
                startDateTime = new Date('Thu Jan 01 1970 18:45:00 GMT+0530 (IST)');
                endDateTime = new Date('Thu Jan 01 1970 12:30:00 GMT+0530 (IST)');
                serviceResponse = {
                    startTime: '18:45:00',
                    endTime: '12:30:00',
                    maxAppointmentsLimit: -4
                };
                serviceTime.$invalid = true;
                serviceMaxLoad.$invalid = true;
            });

            it('should clear incorrect service start and end time and maxLoad if at least one weeklyAvailability is added', function () {
                serviceResponse.weeklyAvailability = [{startTime: new Date().toString(), endTime: new Date().toString(), dayOfWeek: 'SUNDAY'}];
                scope.service = Bahmni.Appointments.AppointmentServiceViewModel.createFromResponse(serviceResponse);
                scope.save();
                expect(scope.service.startTime).toBeUndefined();
                expect(scope.service.endTime).toBeUndefined();
                expect(serviceTime.$setValidity).toHaveBeenCalledWith('timeSequence', true);
                expect(scope.service.maxAppointmentsLimit).toBeUndefined();
                expect(serviceMaxLoad.$setValidity).toHaveBeenCalledWith('min', true);
            });

            it('should clear service maxLoad if at least one service type is added', function () {
                serviceResponse.serviceTypes = [{name: 'newType'}];
                scope.service = Bahmni.Appointments.AppointmentServiceViewModel.createFromResponse(serviceResponse);
                scope.save();
                expect(scope.service.startTime).toEqual(startDateTime);
                expect(scope.service.endTime).toEqual(endDateTime);
                expect(serviceTime.$setValidity).not.toHaveBeenCalled();
                expect(scope.service.maxAppointmentsLimit).toBeUndefined();
                expect(serviceMaxLoad.$setValidity).toHaveBeenCalledWith('min', true);
            });

            it('should not clear service level incorrect start and end time and maxLoad if weeklyAvailability is empty', function () {
                scope.service = Bahmni.Appointments.AppointmentServiceViewModel.createFromResponse(serviceResponse);
                scope.save();
                expect(scope.service.startTime).toEqual(startDateTime);
                expect(scope.service.endTime).toEqual(endDateTime);
                expect(serviceTime.$setValidity).not.toHaveBeenCalled();
                expect(scope.service.maxAppointmentsLimit).toBe(-4);
                expect(serviceMaxLoad.$setValidity).not.toHaveBeenCalled();
            });

            it('should not clear service maxLoad if no service type is added', function () {
                scope.service = Bahmni.Appointments.AppointmentServiceViewModel.createFromResponse(serviceResponse);
                scope.save();
                expect(scope.service.startTime).toEqual(startDateTime);
                expect(scope.service.endTime).toEqual(endDateTime);
                expect(serviceTime.$setValidity).not.toHaveBeenCalled();
                expect(scope.service.maxAppointmentsLimit).toBe(-4);
                expect(serviceMaxLoad.$setValidity).not.toHaveBeenCalled();
            });
        });

        it('should save all appointment service details', function () {
            scope.service = {
                name: 'Chemotherapy',
                description: 'For cancer',
                startTime: new Date().toString(),
                endTime: new Date().toString(),
                weeklyAvailability: [{
                    startTime: new Date().toString(),
                    endTime: new Date().toString(),
                    days: [{name: 'MONDAY', isSelected: true}]
                }]
            };
            var service = Bahmni.Appointments.AppointmentService.createFromUIObject(scope.service);
            scope.save();
            expect(appointmentsServiceService.save).toHaveBeenCalledWith(service);
            expect(messagingService.showMessage).toHaveBeenCalledWith('info', 'APPOINTMENT_SERVICE_SAVE_SUCCESS');
        });

        it('should go to service list page after save', function () {
            var startDateTime = new Date('Thu Jan 01 1970 09:45:00 GMT+0530 (IST)');
            var endDateTime = new Date('Thu Jan 01 1970 18:30:00 GMT+0530 (IST)');
            scope.service = {
                name: 'Chemotherapy',
                description: 'For cancer',
                startTime: startDateTime,
                endTime: endDateTime
            };
            var service = Bahmni.Appointments.AppointmentService.createFromUIObject(scope.service);
            scope.save();
            expect(appointmentsServiceService.save).toHaveBeenCalledWith(service);
            expect(messagingService.showMessage).toHaveBeenCalledWith('info', 'APPOINTMENT_SERVICE_SAVE_SUCCESS');
            expect(state.go).toHaveBeenCalledWith('home.admin.service');
        });

        it('should show error message if form is invalid', function () {
            scope.createServiceForm.$invalid = true;
            scope.save();
            expect(appointmentsServiceService.save).not.toHaveBeenCalled();
            expect(messagingService.showMessage).toHaveBeenCalledWith('error', 'INVALID_SERVICE_FORM_ERROR_MESSAGE');
            expect(state.go).not.toHaveBeenCalled();
        });
    });

    describe('confirmationDialogOnStateChange', function () {
        beforeEach(function () {
            state.name = 'home.service';
            createController();
            scope.createServiceForm = {$dirty: true};
        });

        it('should not open confirmation dialog if form is not edited', function () {
            scope.createServiceForm = {$dirty: false};
            scope.$broadcast("$stateChangeStart");
            expect(ngDialog.openConfirm).not.toHaveBeenCalled();
        });

        it('should ignore the color attribute of service while checking atleast one value set during $stateChangeStart', function () {
            scope.service = {
                color: "#A9A9A9"
            };
            scope.$broadcast("$stateChangeStart");
            expect(ngDialog.openConfirm).not.toHaveBeenCalled();
        });

        it('should open confirmation dialog if form is filled', function () {
            scope.service = {
                name: 'Pathology',
                description: 'For viral diseases'
            };
            scope.$broadcast("$stateChangeStart");
            expect(ngDialog.openConfirm).toHaveBeenCalledWith({
                template: 'views/admin/appointmentServiceSaveConfirmation.html',
                scope: scope,
                closeByEscape: true
            });
        });

        it('should stay in current state if Cancel is selected', function () {
            expect(state.name).toEqual('home.service');
            scope.cancelTransition();
            expect(state.name).toEqual('home.service');
            expect(ngDialog.close).toHaveBeenCalled();
        });

        it("should not save and go to target state if Don't save is selected", function () {
            var toState = {name: "home.manage"};
            var toParams = {config: 'default'};
            expect(state.name).toEqual("home.service");
            scope.save = jasmine.createSpy('save');
            scope.toStateConfig = {toState: toState, toParams: toParams};
            scope.continueWithoutSaving();
            expect(state.go).toHaveBeenCalledWith(toState, toParams);
            expect(ngDialog.close).toHaveBeenCalled();
        });
    });
});