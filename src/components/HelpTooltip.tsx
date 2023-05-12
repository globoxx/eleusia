import { IconButton, Tooltip } from "@mui/material";
import React from "react";
import HelpIcon from '@mui/icons-material/Help';

export default function HelpTooltip({title}: {title: string}) {
    return (
      <Tooltip title={title} placement="top">
        <IconButton>
          <HelpIcon />
        </IconButton>
      </Tooltip>
    )
  }