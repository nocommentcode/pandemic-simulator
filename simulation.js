// utility functions
randomInt = function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}

// Classes
class DisplacementTime {
    constructor(lowerBound, higherBound) {
        
        if (typeof lowerBound !== 'undefined' && typeof higherBound !== 'undefined') {
            this.velocity = [randomInt(lowerBound, higherBound), randomInt(lowerBound, higherBound)]
        }
        else {
            this.velocity = [0, 0]
        }

    }

    reset = function () {
        this.velocity = [0, 0]
    }

    set_value = function (value) {
        Object.assign(this.velocity, value)
    }

    get_val = function () {
        return this.velocity
    }

    clip = function (lower1, upper1, lower2, upper2) {
        this.velocity[0] = Math.min(this.velocity[0], upper1)
        this.velocity[0] = Math.max(this.velocity[0], lower1)

        this.velocity[1] = Math.min(this.velocity[1], upper2)
        this.velocity[1] = Math.max(this.velocity[1], lower2)
    }

    add_random = function (factor) {
        this.velocity[0] += randomInt(-1, 1) * Math.random() * factor;
        this.velocity[1] += randomInt(-1, 1) * Math.random() * factor;
        return this
    }

    add = function (velocity) {
        this.velocity[0] += velocity.get_val()[0];
        this.velocity[1] += velocity.get_val()[1];
        return this
    }

    minus = function (velocity) {
        this.velocity[0] -= velocity.get_val()[0];
        this.velocity[1] -= velocity.get_val()[1];
        return this
    }

    eucledian_dist = function (velocity) {
        let c2 = Math.pow(this.velocity[0] - velocity.get_val()[0], 2) + Math.pow(this.velocity[1] - velocity.get_val()[1], 2)
        return Math.sqrt(c2)
    }

}

class Person {
    constructor(position, infection_status, environment, travel_radius, aysmptomatic_p) {
        this.position = position;
        this.travel_radius = travel_radius
        this.infection_status = infection_status
        this.environment = environment;
        this.velocity = new DisplacementTime();
        this.time_to_recoverty = Math.floor(RECOVERY_TIME_MEAN + (Math.random() * RECOVERY_TIME_SD));
        this.days_infected = 0
        this.starting_pos = new DisplacementTime()
        this.starting_pos.set_value(position.get_val())
        this.aysmptomatic_p = aysmptomatic_p 
    }

    move = function () {
        this.velocity.add_random(VELCOCITY_FACTOR);
        this.environment.clip_vel(this.position, this.velocity)
        
        let current = this.position.get_val()
        let start = this.starting_pos.get_val()
        let deltaX = current[0] - start[0]
        let deltaY = current[1] - start[1]
        let vel = this.velocity.get_val()

        if(this.travel_radius && Math.abs(deltaX) > (this.travel_radius /2) * 0.95){
            // need to go right
            if(deltaX < 0 && vel[0] < 0){
                vel[0] *= -1
            }
            // need to go left
            else if(deltaX > 0 && vel[0] > 0){
                vel[0] *= -1
            }
        }
        if(this.travel_radius && Math.abs(deltaY) > (this.travel_radius /2)  * 0.95){
            // need to go up
            if(deltaY < 0 && vel[1] < 0){
                vel[1] *= -1
            }
            // need to go down
            else if(deltaY > 0 && vel[1] > 0){
                vel[1] *= -1
            }
        }

        this.velocity.set_value(vel)
        this.position.add(this.velocity);
        if(this.travel_radius){
            let start = this.starting_pos.get_val()
            let cur = this.position.get_val()
            this.position.clip(start[0] - (this.travel_radius / 2), start[0] + (this.travel_radius / 2), start[1] - (this.travel_radius / 2), start[1] + (this.travel_radius / 2))
        }
        this.environment.clip_pos(this.position);

        if (this.infection_status == INFECTION_STATUS.INFECTIOUS || this.infection_status == INFECTION_STATUS.ASYMPTOMATIC) {
            let other_people = this.environment.get_surrounding_people(this.position);
            other_people.forEach(person => {
                person.contact();
            });
        }
       


    }




    forwards = function () {
        if (this.infection_status == INFECTION_STATUS.INFECTIOUS || this.infection_status ==  INFECTION_STATUS.ASYMPTOMATIC) {
            this.time_to_recoverty -= 1;
            this.days_infected += 1
            if (this.time_to_recoverty == 0) {
                this.infection_status = INFECTION_STATUS.RECOVERED
                if (Math.random() < DEATH_RATE) {
                    this.infection_status = INFECTION_STATUS.DIED
                }
            }
        }

    }


    contact = function () {
        if (this.infection_status == INFECTION_STATUS.NOT_INFECTED && Math.random() < INFECTION_PROB) {
            this.infection_status = INFECTION_STATUS.INFECTIOUS;
            if(Math.random() < this.aysmptomatic_p){
                this.infection_status = INFECTION_STATUS.ASYMPTOMATIC;
            }
        }
    }
}

class Environment {
    constructor(general_settings, graph_settings, q_settings) {

        this.run_speed = general_settings.run_speed
        this.people_count = general_settings.people_count
        this.n_steps = general_settings.n_steps
        this.size = general_settings.size
        this.start_infections = general_settings.start_infections
        this.travel_radius = general_settings.travel_radius
        this.store_enabled = general_settings.store_enabled
        this.aysmptomatic_p = general_settings.aysmptomatic_p

        this.scatter_ctx = graph_settings.scatter_ctx
        this.curve_ctx = graph_settings.curve_ctx
        this.daily_ctx = graph_settings.daily_ctx
        this.curve_freq = graph_settings.curve_freq
        this.steps = 0

        this.q_enabled = q_settings.q_enabled
        this.q_threshold = q_settings.q_threshold
        this.q_threshold_reached = false
        this.q_responsovness = q_settings.q_responsovness
        this.q_status = {}
        this.q_size = Math.floor(Q_SIZE_PT * this.size)
        this.q_centre = new DisplacementTime()
        this.q_centre.set_value([this.size - (this.q_size / 2), this.q_size / 2])

        this.people = []
        for (var p = 0; p < this.people_count; p++) {
            let infection_status = INFECTION_STATUS.NOT_INFECTED
            if (this.start_infections > 0) {
                this.start_infections -= 1
                infection_status = INFECTION_STATUS.INFECTIOUS
                if (Math.random() < this.aysmptomatic_p ){
                    infection_status = INFECTION_STATUS.ASYMPTOMATIC
                }
            }

            let pos = new DisplacementTime(0, this.size)

            // handle case in quarentine and spawn within trvel restriction boundary
            if(this.q_enabled && pos[0] > this.size - this.q_size && pos[1] < this.q_size){
                if (this.travel_radius){
                    pos.clip(this.travel_radius/2, this.size - (this.travel_radius /2), this.q_size - (this.travel_radius/2) , this.size - (this.travel_radius/2))
                }else{
                    pos.clip(0, this.size, this.q_size, this.size)
                }
            }
            
            let person = new Person(pos, infection_status, this, this.travel_radius, this.aysmptomatic_p)
            person.q_status = false
            person.store_status = false

            this.people.push(person)
        }

        this.initialise_display()
    }


    get_surrounding_people = function (pos) {
        let people = []
        this.people.forEach(person => {

            if (person.position.eucledian_dist(pos) < INFECTION_RADIUS) {
                people.push(person);
            }
        })

        return people
    }

    handle_store = function(person){
        if(!person.q_status && !person.store_status && Math.random() < STORE_VISIT_PROB){
            person.store_status = true
            person.store_count = 0
            person.position.set_value([this.size / 2, this.size /2])
        }else if(!person.q_status && person.store_status){
            person.store_count += 1
            if(person.store_count >= MAX_STORE_TIME){
                person.store_status = false
                person.position.set_value(person.starting_pos.get_val())
            }
           
        }
    }

    handle_quarentine = function (person, counts) {
        if (this.q_threshold_reached || counts[INFECTION_STATUS.INFECTIOUS] +  counts[INFECTION_STATUS.RECOVERED]>= this.q_threshold) {

            // infectious and goes into quarentine -> send into quaretine
            if (person.infection_status == INFECTION_STATUS.INFECTIOUS && !person.q_status && person.days_infected > this.q_responsovness) {
                this.q_threshold_reached = true
                person.q_status = true
                person.position.set_value(this.q_centre.get_val())
                person.position.add_random(((this.q_size * 0.85) / 2) - 1)
                person.position.clip(this.size - (this.q_size * 0.85), this.size, 0, this.q_size * 0.85)

            } 
            // in quarentine and has recovered -> send back to starting pos
            else if ((person.infection_status == INFECTION_STATUS.RECOVERED || person.infection_status == INFECTION_STATUS.DIED) && person.q_status) {
                person.q_status = false
                person.position.set_value(person.starting_pos.get_val())
            }

        }
    }

    run = async function (epochs) {
        for (var e = 0; e < epochs; e++) {
            var counts = [0, 0, 0, 0, 0]

            this.people.forEach(person => {

                // move if not dead, if Q enabled, move if not quarentined
                if (person.infection_status != INFECTION_STATUS.DIED) {
                    if ((!this.q_enabled || !person.q_status) &&(!this.store_enabled || !person.store_status)) {
                        person.move()
                    }
                }

                // progress and record status 
                person.forwards()
                counts[person.infection_status] += 1

                // handle quarentine if enabled
                if (this.q_enabled) {
                    this.handle_quarentine(person, counts)
                }

                // handle store if enabled
                if (this.store_enabled){
                    this.handle_store(person)
                }
                

            })

            // update current status counts
            this.new_infected_sum += Math.max(counts[INFECTION_STATUS.INFECTIOUS] +
                 counts[INFECTION_STATUS.ASYMPTOMATIC] -
                  this.infectious_count - this.aysmptomatic_count, 0)
            this.new_dead_sum += Math.max(counts[INFECTION_STATUS.DIED] - this.dead_count, 0)

            this.infectious_count = counts[INFECTION_STATUS.INFECTIOUS]
            this.non_infectious_count = counts[INFECTION_STATUS.NOT_INFECTED]
            this.recovered_count = counts[INFECTION_STATUS.RECOVERED]
            this.dead_count = counts[INFECTION_STATUS.DIED]
            this.aysmptomatic_count = counts[INFECTION_STATUS.ASYMPTOMATIC]

            this.steps += 1


            // update graphs
            await this.display(counts)

            // stop if no more infected
            if (counts[INFECTION_STATUS.INFECTIOUS] + counts[INFECTION_STATUS.ASYMPTOMATIC] == 0) {
                break
            }
        }
    }

    initialise_scatter = function () {
        // calculate initial positions and colors
        var data = []
        var color = []
        this.people.forEach(person => {
            let pos = person.position.get_val()
            data.push({
                x: pos[0],
                y: pos[1]
            })
            color.push(INFECTOUS_STATUS_COLOR[person.infection_status])
        })

        var options = {
            scales: {
                x: {
                    display: false,
                    gridLines: {
                        display: false
                    },
                    min: 0,
                    max: this.size
                },
                y: {
                    display: false,
                    gridLines: {
                        display: false
                    },
                    min: 0,
                    max: this.size
                }
            },
            plugins: {
                legend: { display: false },
                tootip: { enabled: false },
                autocolors: false,
            },
        };

        // plot quarentine zone if enabled
        if (this.q_enabled) {
            options.plugins.annotation = {
                annotations: {
                    box1: {
                        type: 'box',
                        xMin: this.size - this.q_size,
                        xMax: this.size,
                        yMin: 0,
                        yMax: this.q_size,
                        backgroundColor: 'rgba(255, 99, 132, 0.45)'
                    }
                }
            }
        }

        //plot store if enabled
        if(this.store_enabled){
            if(options.plugins.annotation){
                options.plugins.annotation.annotations.store = {
                    type: 'box',
                    xMin: (this.size / 2) - (STORE_SIZE/2),
                    xMax: (this.size / 2) + (STORE_SIZE/2),
                    yMin: (this.size / 2) - (STORE_SIZE/2),
                    yMax: (this.size / 2) + (STORE_SIZE/2),
                    backgroundColor: 'rgba(0, 0, 132, 0.45)'
                }   
            }else{
                options.plugins.annotation = {
                    annotations: {
                        box1: {
                            type: 'box',
                            xMin: (this.size / 2) - (STORE_SIZE/2),
                            xMax: (this.size / 2) + (STORE_SIZE/2),
                            yMin: (this.size / 2) - (STORE_SIZE/2),
                            yMax: (this.size / 2) + (STORE_SIZE/2),
                            backgroundColor: 'rgba(0, 0, 132, 0.45)'
                        }
                    }
                } 
            }
        }

        // create graph
        this.scatter_graph = new Chart(this.scatter_ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: data,
                    backgroundColor: color,
                    pointRadius: 3,
                }]
            },
            options: options
        });
    }

    initialise_curve = function () {

        var options = {
            animation: { duration: 0 },
            scales: {
                x: {
                    display: false,
                    gridLines: {
                        display: false
                    }
                },
                y: {
                    display: false,
                    gridLines: {
                        display: false
                    }
                }
            },
            plugins: {
                title: {
                    text: "Total",
                    display: true,
                    position: "top"
                }
            }
        }

        this.curve_graph = new Chart(this.curve_ctx, {
            type: 'line',
            data: {
                labels: [1],
                datasets: [{
                    data: [this.start_infections],
                    fill: "origin",
                    label: "Infectious",
                    backgroundColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.INFECTIOUS],
                    showLine: false,
                    spanGaps: true,
                    pointRadius: 0
                },
                {
                    data: [0],
                    fill: 0,
                    label: "Asymptomatic",
                    backgroundColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.ASYMPTOMATIC],
                    showLine: false,
                    spanGaps: true,
                    pointRadius: 0
                },
                {
                    data: [this.people_count],
                    fill: 1,
                    label: "Non Infectious",
                    backgroundColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.NOT_INFECTED],
                    showLine: false,
                    spanGaps: true,
                    pointRadius: 0
                },
                {
                    data: [0],
                    fill: 2,
                    label: "Recovered",
                    backgroundColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.RECOVERED],
                    showLine: false,
                    spanGaps: true,
                    pointRadius: 0
                },
                {
                    data: [0],
                    fill: 3,
                    label: "Dead",
                    backgroundColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.DIED],
                    showLine: false,
                    spanGaps: true,
                    pointRadius: 0
                }]
            },
            options: options
        })
    }

    initialise_daily = function () {
        // store previous sums
        this.new_infected_sum = 0
        this.new_dead_sum = 0


        var options = {
            animation: { duration: 0 },
            scales: {
                x: {
                    display: false,
                    gridLines: {
                        display: false
                    }
                },
                y: {
                    display: false,
                    gridLines: {
                        display: false
                    }
                },
            },
            plugins: {
                title: {
                    text: "Daily",
                    display: true,
                    position: "top"
                }
            }
        }

        this.daily_graph = new Chart(this.daily_ctx, {
            type: "line",
            data: {
                label: [1],
                datasets: [{
                    data: [parseInt(this.start_infections)],
                    label: "Cases",
                    showLine: true,
                    spanGaps: true,
                    borderColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.INFECTIOUS],
                    pointRadius: 0
                }, {
                    data: [0],
                    label: "Deaths",
                    showLine: true,
                    spanGaps: true,
                    borderColor: INFECTOUS_STATUS_COLOR[INFECTION_STATUS.DIED],
                    pointRadius: 0
                }]
            },
            options: options
        })
    }

    initialise_display = function () {
        this.initialise_scatter()
        this.initialise_curve()
        this.initialise_daily()
    }

    display_scatter = function () {
        var data = []
        var color = []

        this.people.forEach(person => {
            let pos = person.position.get_val()
            data.push({
                x: pos[0],
                y: pos[1]
            })
            color.push(INFECTOUS_STATUS_COLOR[person.infection_status])
        })
        this.scatter_graph.data.datasets[0].data = data
        this.scatter_graph.data.datasets[0].backgroundColor = color
        this.scatter_graph.update()
    }

    display_curve = function () {
        this.curve_graph.data.datasets[0].data.push(this.infectious_count)
        this.curve_graph.data.datasets[1].data.push(this.infectious_count + this.aysmptomatic_count)
        this.curve_graph.data.datasets[2].data.push(this.infectious_count + this.aysmptomatic_count + this.non_infectious_count)
        this.curve_graph.data.datasets[3].data.push(this.infectious_count + this.aysmptomatic_count + this.non_infectious_count + this.recovered_count)
        this.curve_graph.data.datasets[4].data.push(this.people_count)

        this.curve_graph.data.labels.push(1);
        this.curve_graph.update()
    }

    display_daily = function () {
        // calculate average daily change
        let av_new_infections = (this.new_infected_sum * 1.0) / this.curve_freq
        let av_new_deaths = (this.new_dead_sum * 1.0) / this.curve_freq

        // plot
        this.daily_graph.data.datasets[0].data.push(av_new_infections)
        this.daily_graph.data.datasets[1].data.push(av_new_deaths)
        this.daily_graph.data.labels.push(1)
        this.daily_graph.update()

        // reset counts
        this.new_infected_sum = 0
        this.new_dead_sum = 0
    }

    display = async function (counts) {

        this.display_scatter()

        // update curve and daily graphs every "curve_freq" steps 
        if (this.steps % this.curve_freq == 0 && LNE_GRAPHS_ON) {
            this.display_curve()
            this.display_daily()
        }

        // update count stats
        stats_field_callback(counts)

        // delay for visual effect
        await new Promise(resolve => setTimeout(resolve, this.run_speed));
    }


    clip_pos = function (pos) {
        let position = pos.get_val()
        if(this.q_enabled && position[0] > (this.size - this.q_size) && position[1] < this.q_size){  
            pos.clip(0, this.size, this.q_size, this.size)
        }else{
            pos.clip(0, this.size, 0, this.size)
        }
    }

    clip_vel = function (position, velocity) {

        let pos = position.get_val()
        let vel = velocity.get_val()

        // clip x and y less than 0
        if (pos[0] < 0.05 * this.size && vel[0] < 0) {
            vel[0] *= -1
        }
        if (pos[1] < 0.05 * this.size && vel[1] < 0) {
            vel[1] *= -1
        }
        // x close to end of boundary -> go away from boundary
        if (pos[0] > this.size * 0.95 && vel[0] > 0) {
            vel[0] *= -1
        }
        // y close to boundary -> go away from boundary
        else if (pos[1] > this.size * 0.95 && vel[1] > 0) {
            vel[1] *= -1
        }

        if (this.q_enabled) {
            // x on top of quarentine and close to end of boundary -> go away from boundary
            if (pos[0] > this.size * 0.95 && pos[1] > this.q_size && vel[0] > 0) {
                vel[0] *= -1
            }
            // x close to going in to quarentine -> go away from quarentine
            else if (pos[0] > ((this.size - this.q_size) * 0.95) && pos[1] < this.q_size && vel[0] > 0) {
                vel[0] *= -1
            }

            // y close to quarentine -> go away from quarentine
            if (pos[1] < this.q_size * 1.05 && pos[0] > (this.size - this.q_size) && vel[1] < 0) {
                vel[1] *= -1
            }
            // y close to boundary -> go away from boundary
            else if (pos[1] > this.size * 0.95 && vel[1] > 0) {
                vel[1] *= -1
            }

        }
        
        velocity.set_value(vel)
        position.set_value(pos)
    }

}


// Settings
INFECTION_STATUS = {
    INFECTIOUS: 0,
    NOT_INFECTED: 1,
    RECOVERED: 2,
    DIED: 3,
    ASYMPTOMATIC: 4
}
INFECTOUS_STATUS_COLOR = {
    0: "#DA583C",
    1: "#0D549E",
    2: "#4CDB40",
    3: "#0F2033",
    4: "#ffdb4d"
}

Q_THRESHOLD_BASE = 30
Q_RESPONSIVENESS_BASE = 23
Q_SIZE_PT = 0.3

TRAVEL_RADIUS_BASE = 25//60
RECOVERY_TIME_MEAN = 150;
RECOVERY_TIME_SD = 30;
DEATH_RATE = 0.06;

INFECTION_PROB_BASE = 0.4
INFECTION_RADIUS_BASE = 15;
ASYMPTOMATIC_P = 0.23

STORE_SIZE = 10
STORE_VISIT_PROB = 0.001
MAX_STORE_TIME = 50

CURVE_FREQ = 5
RUN_SPEED = 20
VELCOCITY_FACTOR = 0.1
LNE_GRAPHS_ON = true

ENV_SIZE = 200
N_STEPS = 10000

STATS_FILD_IDS = {
    0: "#infectious-count-field",
    1: "#non-infectious-count-field",
    2: "#recovered-count-field",
    3: "#dead-count-field"
}

function stats_field_callback(counts){
    $(STATS_FILD_IDS[INFECTION_STATUS.INFECTIOUS].toString()).html(counts[INFECTION_STATUS.INFECTIOUS])
    $(STATS_FILD_IDS[INFECTION_STATUS.NOT_INFECTED].toString()).html(counts[INFECTION_STATUS.NOT_INFECTED])
    $(STATS_FILD_IDS[INFECTION_STATUS.RECOVERED].toString()).html(counts[INFECTION_STATUS.RECOVERED])
    $(STATS_FILD_IDS[INFECTION_STATUS.DIED].toString()).html(counts[INFECTION_STATUS.DIED])
}

selected_preset = null

PRESETS = {
    "PRESET_1" : {
        general_settings : {
            people_count : 300,
            size: ENV_SIZE,
            start_infections : 2,
            social_dist : 3,
            n_steps: N_STEPS,
            hygene : 3,
            masks : 3,
            travel_radius : false,
            store_enabled : false,
            aysmptomatic_p: ASYMPTOMATIC_P
        },
        q_settings : {
            q_enambled : false,
            q_threshold : 0,
            q_responsiveness : 0
        }
    },
    "PRESET_2" : {
        general_settings : {
            people_count : 300,
            size: ENV_SIZE,
            start_infections : 1,
            social_dist : 8,
            n_steps: N_STEPS,
            hygene : 3,
            masks : 3,
            travel_radius : ENV_SIZE / 5,   
            store_enabled : false,
            aysmptomatic_p: ASYMPTOMATIC_P
        },
        q_settings : {
            q_enabled : true,
            q_threshold : 1 * Q_THRESHOLD_BASE,
            q_responsovness: 3 * Q_RESPONSIVENESS_BASE
        }
    },

    "PRESET_3" : {
        general_settings : {
            people_count : 300,
            size: ENV_SIZE,
            start_infections : 2,
            social_dist : 4,
            n_steps: N_STEPS,
            hygene : 4,
            masks : 4,
            travel_radius : ENV_SIZE / 9,
            store_enabled : true,
            aysmptomatic_p: ASYMPTOMATIC_P
        },
        q_settings : {
            q_enabled : true,
            q_threshold : 1 * Q_THRESHOLD_BASE,
            q_responsovness: 1 * Q_RESPONSIVENESS_BASE
        }
    }

}


function get_q_settings(){
    if(SELECTED_PRESET == false){
        let q_enambled = $("#setting-quarentine-enabled").is(':checked')
        let q_threshold = $("#setting-quaretine-threshold").val()
        let q_responsiveness = $("#setting-quaretine-response").val()
    
        var q_settings = {
            q_enabled: q_enambled,
            q_threshold: q_threshold * Q_THRESHOLD_BASE,
            q_responsovness: q_responsiveness * Q_RESPONSIVENESS_BASE
        }
    }else{
        var q_settings = PRESETS[SELECTED_PRESET].q_settings
    }

    return q_settings
}

function get_general_settings(){
    if(SELECTED_PRESET == false){
        let population = $("#setting-population").val()
        let infected_population = $("#setting-infections").val()
        let social_dist = $("#setting-social-dist").val()
        let hygene = $("#setting-hygene").val()
        let masks = $("#setting-masks").val()
        let travel_radius = $("#setting-travel-radius").val()
        let store_enabled = $('#setting-store-enabled').is(':checked')
    
        if(parseInt(travel_radius) == 0){
            travel_radius = false
        }else if (parseInt(travel_radius) == 5){
            travel_radius = 5
        }
        else{
            travel_radius = ENV_SIZE / ((parseInt(travel_radius) * 2) +1)
        }
    
        INFECTION_PROB = INFECTION_PROB_BASE / ((social_dist * 0.5) + (hygene * 0.5) + 1)
        INFECTION_RADIUS = INFECTION_RADIUS_BASE / (masks * 0.6 + 1)
    
        var general_settings = {
            size: ENV_SIZE,
            people_count: parseInt(population),
            start_infections: parseInt(infected_population),
            n_steps: N_STEPS,
            travel_radius:travel_radius,
            store_enabled: store_enabled,
            aysmptomatic_p:ASYMPTOMATIC_P
        }
    }else{
        var general_settings = PRESETS[SELECTED_PRESET].general_settings

        INFECTION_PROB = INFECTION_PROB_BASE / ((general_settings.social_dist * 0.5) + (general_settings.hygene * 0.5) + 1)
        INFECTION_RADIUS = INFECTION_RADIUS_BASE / (general_settings.masks * 0.6 + 1)
    }

    return general_settings
}

function get_graph_settings(){
    scatter_ctx = document.getElementById("scatter").getContext('2d');
    curve_ctx = document.getElementById("curve").getContext('2d');
    daily_ctx = document.getElementById("daily").getContext('2d');

    var graph_settings = {
        scatter_ctx: scatter_ctx,
        curve_ctx: curve_ctx,
        daily_ctx: daily_ctx,
        curve_freq: CURVE_FREQ,
        run_speed: RUN_SPEED
    }

    return graph_settings
}



var env = null

async function run_environemnt() {        

    // destroy previous graphs if they exist
    if (env) {
        if (env.scatter_graph) {
            env.scatter_graph.destroy()
        }
        if (env.curve_graph) {
            env.curve_graph.destroy()
        }
        if (env.daily_graph) {
            env.daily_graph.destroy()
        }
    }

    let general_settings = get_general_settings()
    let q_settings = get_q_settings()
    let graph_settings = get_graph_settings()
    console.log(general_settings,q_settings, graph_settings)

    // build environment
    env = new Environment(general_settings, graph_settings, q_settings)

    // run
    await env.run(N_STEPS)

}

$(document).ready(function () {
    
    // buttons
    $("#start-sym-btn").click(() => {
        $("#home-screen").hide()
        $("#simulation").show()
        SELECTED_PRESET = false
        run_environemnt()
    })
    $("#exit-btn").click(() => {
        $("#simulation").hide()
        $("#home-screen").show()
    })
    $("#replay-btn").click(() => {
        run_environemnt()

    })
    $("#preset-1-btn").click(() => {
        $("#home-screen").hide()
        $("#simulation").show()
        SELECTED_PRESET = "PRESET_1"
        run_environemnt()
    })
    $("#preset-2-btn").click(() => {
        $("#home-screen").hide()
        $("#simulation").show()
        SELECTED_PRESET = "PRESET_2"
        run_environemnt()
    })
    $("#preset-3-btn").click(() => {
        $("#home-screen").hide()
        $("#simulation").show()
        SELECTED_PRESET = "PRESET_3"
        run_environemnt()
    })

    // dynamic instructions for sliders setup
    $("#setting-social-dist").change(()=>{
        let val =$("#setting-social-dist").val()
        let desc = ""
        if(val == "0"){
            desc = "What's social distancing"
        }else if(val == "1"){
            desc = "Shops have 1.5 meter markers in line"
        }else if(val == "2"){
            desc = "Some people stay 1.5 meters apart"
        }else if(val == "3"){
            desc = "Most people stay 1.5 meters apart"
        }else if(val == "4"){
            desc = "People cross the street when someone walks past"
        }else if(val == "5"){
            desc = "Everyone walks around in a plastic bubble"
        }
        $("#desc-social-dist").html(desc)
    })
    $("#setting-hygene").change(()=>{
        let val =$("#setting-hygene").val()
        let desc = ""
        if(val == "0"){
            desc = "People cough on each other"
        }else if(val == "1"){
            desc = "People wash their hands when they get home"
        }else if(val == "2"){
            desc = "Some people sanitise when entering shops"
        }else if(val == "3"){
            desc = "Most people sanitise when entering shops"
        }else if(val == "4"){
            desc = "Strict hand sanitising"
        }else if(val == "5"){
            desc = "Strict hand sanitising and regular deep cleans"
        }
        $("#desc-hygene").html(desc)
    })
    $("#setting-masks").change(()=>{
        let val =$("#setting-masks").val()
        console.log(val)

        let desc = ""
        if(val == "0"){
            desc = "Surgeons wear masks"
        }else if(val == "1"){
            desc = "Grandparents wear masks"
        }else if(val == "2"){
            desc = "Some people wear masks"
        }else if(val == "3"){
            desc = "Most people wear masks"
        }else if(val == "4"){
            desc = "Mask mandate, $300 fine"
        }else if(val == "5"){
            desc = "Everyone wears 2 masks and a face shield"
        }
        $("#desc-masks").html(desc)
    })
    $("#setting-quaretine-threshold").change(()=>{
        let val =$("#setting-quaretine-threshold").val()
        let desc = ""
        if(val == "0"){
            desc = "Immediate goverment response"
        }else if(val == "1"){
            desc = "Quarentine starts after the first few cases"
        }else if(val == "2"){
            desc = "Quarentine implemented after case numbers rise"
        }else if(val == "3"){
            desc = "Quarentine implemented after people start to die"
        }else if(val == "4"){
            desc = "Quarentine implemented very late"
        }else if(val == "5"){
            desc = "Half the country is dead, still no quarentine"
        }
        $("#desc-quaretine-threshold").html(desc)
    })
    $("#setting-quaretine-response").change(()=>{
        let val =$("#setting-quaretine-response").val()
        let desc = ""
        if(val == "0"){
            desc = "People are quarentined before they get symptoms"
        }else if(val == "1"){
            desc = "People are quarentined as soon as they get symptoms"
        }else if(val == "2"){
            desc = "People are quarentined within days of getting symptoms"
        }else if(val == "3"){
            desc = "People are quarentined weeks after first symptoms"
        }else if(val == "4"){
            desc = "People are quarentined when they feel like it"
        }else if(val == "5"){
            desc = "People get quarentined once they die"
        }
        $("#desc-quaretine-response").html(desc)
    })
    $("#setting-travel-radius").change(()=>{
        let val =$("#setting-travel-radius").val()
        let desc = ""
        if(val == "0"){
            desc = "People are free to travel as they please"
        }else if(val == "1"){
            desc = "People cannot leave their country"
        }else if(val == "2"){
            desc = "Inter city travel is restricted"
        }else if(val == "3"){
            desc = "Inter city travel is completely banned"
        }else if(val == "4"){
            desc = "Strick 5km rule implemented"
        }else if(val == "5"){
            desc = "People do not leave their own house"
        }
        $("#desc-travel-radius").html(desc)
    })  
    $("#setting-quarentine-enabled").change(() =>{
        if($("#setting-quarentine-enabled").is(':checked')) {
            $("#q-responsiveness-row").show()
            $("#q-threshold-row").show()
        }else{
            $("#q-responsiveness-row").hide()
            $("#q-threshold-row").hide()
        }
    })
                        

        $("#preset-3-label").click(async () => {
            $("#preset-2-desc").hide()
            $("#preset-1-desc").hide()
            $("#preset-3-desc").fadeIn()
          

            $("#preset-2-btn").hide()
            $("#preset-1-btn").hide()
            $("#preset-3-btn").fadeIn()
        })
        $("#preset-2-label").click(() => {
            
            $("#preset-1-desc").hide()
            $("#preset-3-desc").hide()
            $("#preset-2-desc").fadeIn()

            $("#preset-1-btn").hide()
            $("#preset-3-btn").hide()
            $("#preset-2-btn").fadeIn()
        })
        $("#preset-1-label").click(() => {
            $("#preset-2-desc").hide()
            $("#preset-3-desc").hide()
            $("#preset-1-desc").fadeIn()

            $("#preset-2-btn").hide()
            $("#preset-3-btn").hide()
            $("#preset-1-btn").fadeIn()
        })
})


