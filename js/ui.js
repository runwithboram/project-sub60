function renderApp(){

    const app = document.getElementById("app");

    app.innerHTML = `
        ${renderHero()}
        ${renderToday()}
        ${renderProgress()}
        ${renderRace()}
        ${renderCoach()}
    `;

}

function renderHero(){

    return `
        <header class="hero">

            <span class="greeting">
                ☀️ Good Morning
            </span>

            <h1>Road to SUB60</h1>

            <p>${appData.user.goal}</p>

        </header>
    `;

}

function renderToday(){

    return `

        <section class="card">

            <h2>Today's Training</h2>

            <strong>

                ${appData.today.training}

            </strong>

            <p>

                ${appData.today.distance} km

            </p>

        </section>

    `;

}

function renderProgress(){

    return `

        <section class="card">

            <h2>

                Weekly Progress

            </h2>

            <strong>

                ${appData.weekly.current}

                /

                ${appData.weekly.goal} km

            </strong>

        </section>

    `;

}

function renderRace(){

    const race = appData.races[0];

    return `

        <section class="card">

            <h2>

                Next Race

            </h2>

            <strong>

                ${race.name}

            </strong>

            <p>

                Target

                ${race.target}

            </p>

        </section>

    `;

}

function renderCoach(){

    return `

        <section class="card">

            <h2>

                Coach

            </h2>

            <p>

                오늘은

                Easy Run으로

                컨디션을 유지하세요.

            </p>

        </section>

    `;

}
