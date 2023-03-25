import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { User, RoomData } from '../../server';

function UsersTable({roomData}: {roomData: RoomData}) {
    return (
        <TableContainer component={Paper}>
        <Table aria-label="simple table">
            <TableHead>
            <TableRow>
                <TableCell>Joueur</TableCell>
                <TableCell align="right">Score</TableCell>
            </TableRow>
            </TableHead>
            <TableBody>
            {Object.entries(roomData.users).map(([pseudo, user]: [string, User]) => (
                (pseudo !== roomData.creator) && (
                    <TableRow
                    key={pseudo}
                    sx={{ '&:last-child td, &:last-child th': { border: 0, color: (user.vote ? 'green' : 'red') } }}
                    >
                    <TableCell component="th" scope="row">
                        {pseudo}
                    </TableCell>
                    <TableCell align="right">{user.score}</TableCell>
                    </TableRow>
                )
            ))}
            {!roomData.hasStarted && (
                <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                        En attende de joueur...
                    </TableCell>
                </TableRow>
                )
            }
            </TableBody>
        </Table>
        </TableContainer>
    )
}

export default UsersTable;